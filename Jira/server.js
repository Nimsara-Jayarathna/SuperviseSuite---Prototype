// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Your App Credentials
const CLIENT_ID = process.env.ATLASSIAN_CLIENT_ID || 'sM1su74gY8oWnloT2TmjWD4aB7L0EHyI';
const CLIENT_SECRET = process.env.ATLASSIAN_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = process.env.ATLASSIAN_REDIRECT_URI || 'http://127.0.0.1:5501/SuperviseSuite---Prototype/Jira/jira.html';
const STATE_STRING = process.env.ATLASSIAN_OAUTH_STATE || 'prototype_testing_123';
const ATLASSIAN_SCOPE = process.env.ATLASSIAN_SCOPE || 'read:jira-user read:jira-work';
const CACHE_PATH = path.join(__dirname, 'jira-analytics-cache.json');

function buildAtlassianAuthUrl() {
    const params = new URLSearchParams({
        audience: 'api.atlassian.com',
        client_id: CLIENT_ID,
        scope: ATLASSIAN_SCOPE,
        redirect_uri: REDIRECT_URI,
        state: STATE_STRING,
        response_type: 'code',
        prompt: 'consent'
    });
    return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

app.get('/api/auth-url', (req, res) => {
    res.json({ success: true, url: buildAtlassianAuthUrl() });
});

app.get('/api/jira-cached-data', (req, res) => {
    const cached = readCache();
    if (!cached) {
        return res.status(404).json({ success: false, error: 'No cached Jira analytics found yet.' });
    }
    res.json({ success: true, ...cached });
});

function readCache() {
    try {
        if (!fs.existsSync(CACHE_PATH)) return null;
        return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch (error) {
        console.error('Cache read error:', error.message);
        return null;
    }
}

function writeCache(payload) {
    try {
        fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    } catch (error) {
        console.error('Cache write error:', error.message);
    }
}

function logAxiosError(context, error, extra = {}) {
    const status = error?.response?.status || null;
    const responseData = error?.response?.data || null;
    const method = error?.config?.method ? String(error.config.method).toUpperCase() : null;
    const url = error?.config?.url || null;

    console.error('[JIRA_API_DEBUG]', {
        context,
        method,
        url,
        status,
        message: error?.message || 'Unknown error',
        responseData,
        ...extra
    });
}

function toLocalDate(dateString) {
    if (!dateString) return 'N/A';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString();
}

function extractDocumentText(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractDocumentText).join(' ').trim();
    const text = node.text ? String(node.text) : '';
    const contentText = node.content ? extractDocumentText(node.content) : '';
    return `${text} ${contentText}`.trim();
}

function getStoryPoints(issue) {
    const fields = issue.fields || {};
    for (const [key, value] of Object.entries(fields)) {
        if (!key.startsWith('customfield_')) continue;
        if (typeof value === 'number') return value;
    }
    return 0;
}

function isDoneStatus(statusName) {
    return ['done', 'closed', 'resolved'].includes((statusName || '').toLowerCase());
}

async function getCloudId(accessToken) {
    const cloudResponse = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!cloudResponse.data || !cloudResponse.data.length) {
        throw new Error('No accessible Jira resources found for this user.');
    }
    const resourcesWithScopes = cloudResponse.data.map((resource) => ({
        id: resource.id,
        name: resource.name,
        scopes: resource.scopes || []
    }));
    console.error('[JIRA_API_DEBUG]', JSON.stringify({
        context: 'accessible_resources_scopes',
        resources: resourcesWithScopes
    }, null, 2));
    return cloudResponse.data[0].id;
}

async function getBestBoard(baseUrl, headers) {
    const boardsResponse = await axios.get(`${baseUrl}/rest/agile/1.0/board?maxResults=50`, { headers });
    const boards = boardsResponse.data.values || [];
    const scrumBoards = boards.filter((board) => board.type === 'scrum');
    const selected = scrumBoards[0] || boards[0];
    if (!selected) throw new Error('No Jira boards found for this user.');
    return selected;
}

async function getRecentSprints(baseUrl, headers, boardId) {
    const sprintsResponse = await axios.get(`${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&maxResults=50`, { headers });
    const allSprints = (sprintsResponse.data.values || []).sort((a, b) => new Date(b.startDate || b.endDate || 0) - new Date(a.startDate || a.endDate || 0));
    return allSprints.slice(0, 5);
}

async function getSprintIssues(baseUrl, headers, sprintId) {
    const params = new URLSearchParams({
        maxResults: '100',
        fields: 'summary,status,issuetype,assignee,updated,created,resolutiondate,parent,priority,reporter,labels,description,customfield_10014,customfield_10008'
    });
    const response = await axios.get(`${baseUrl}/rest/agile/1.0/sprint/${sprintId}/issue?${params.toString()}`, { headers });
    return response.data.issues || [];
}

function summarizeSprint(sprint, issues) {
    let doneCount = 0;
    let storyPointsTotal = 0;
    let storyPointsDone = 0;
    const assignees = {};
    const statusCounts = {};

    issues.forEach((issue) => {
        const statusName = issue.fields?.status?.name || 'Unknown';
        const points = getStoryPoints(issue);
        const done = isDoneStatus(statusName);
        const assignee = issue.fields?.assignee?.displayName || 'Unassigned';

        storyPointsTotal += points;
        if (done) {
            doneCount += 1;
            storyPointsDone += points;
        }
        statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;

        assignees[assignee] = (assignees[assignee] || 0) + points;
    });

    const completionByIssues = issues.length ? Math.round((doneCount / issues.length) * 100) : 0;
    const completionByPoints = storyPointsTotal ? Math.round((storyPointsDone / storyPointsTotal) * 100) : completionByIssues;

    return {
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        goal: sprint.goal || '',
        startDate: toLocalDate(sprint.startDate),
        endDate: toLocalDate(sprint.endDate),
        issueCount: issues.length,
        doneIssueCount: doneCount,
        storyPointsTotal,
        storyPointsDone,
        completionPercent: completionByPoints,
        completionByIssues,
        assignees,
        statusCounts
    };
}

function formatIssue(issue) {
    const issueTypeName = issue.fields?.issuetype?.name || 'Issue';
    const isSubtask = Boolean(issue.fields?.issuetype?.subtask);
    const parent = issue.fields?.parent || null;
    const epicLink = issue.fields?.customfield_10014 || issue.fields?.customfield_10008 || null;

    let epicKey = null;
    let epicName = null;
    if (issueTypeName.toLowerCase() === 'epic') {
        epicKey = issue.key;
        epicName = issue.fields?.summary || issue.key;
    } else if (parent?.fields?.issuetype?.name?.toLowerCase() === 'epic') {
        epicKey = parent.key;
        epicName = parent?.fields?.summary || parent.key;
    } else if (typeof epicLink === 'string' && epicLink.trim()) {
        epicKey = epicLink.trim();
    } else if (epicLink && typeof epicLink === 'object') {
        epicKey = epicLink.key || epicLink.id || null;
        epicName = epicLink.name || epicLink.value || null;
    }

    return {
        key: issue.key,
        title: issue.fields?.summary || '(No summary)',
        type: issueTypeName,
        isSubtask,
        parentKey: parent?.key || null,
        parentTitle: parent?.fields?.summary || null,
        epicKey,
        epicName,
        status: issue.fields?.status?.name || 'Unknown',
        assignee: issue.fields?.assignee?.displayName || 'Unassigned',
        reporter: issue.fields?.reporter?.displayName || 'Unknown',
        priority: issue.fields?.priority?.name || 'Unspecified',
        labels: issue.fields?.labels || [],
        created: toLocalDate(issue.fields?.created),
        updated: toLocalDate(issue.fields?.updated),
        description: extractDocumentText(issue.fields?.description) || 'No description.'
    };
}

function buildHierarchyFromIssues(issues) {
    const byKey = new Map();
    issues.forEach((issue) => byKey.set(issue.key, issue));

    const epicMap = new Map();
    const storyMap = new Map();

    function getOrCreateEpic(epicKey) {
        const key = epicKey || 'NO_EPIC';
        if (!epicMap.has(key)) {
            const epicIssue = byKey.get(epicKey);
            epicMap.set(key, {
                key,
                title: epicIssue?.title || (epicKey ? `Epic ${epicKey}` : 'No Epic'),
                status: epicIssue?.status || 'Unspecified',
                stories: []
            });
        }
        return epicMap.get(key);
    }

    issues.forEach((issue) => {
        const typeLower = (issue.type || '').toLowerCase();
        if (typeLower === 'epic') {
            getOrCreateEpic(issue.key).title = issue.title;
            getOrCreateEpic(issue.key).status = issue.status;
            return;
        }
        if (!issue.isSubtask) {
            const epic = getOrCreateEpic(issue.epicKey);
            if (issue.epicName && epic.title.startsWith('Epic ')) {
                epic.title = issue.epicName;
            }
            const story = { ...issue, subtasks: [] };
            epic.stories.push(story);
            storyMap.set(issue.key, story);
        }
    });

    issues.forEach((issue) => {
        if (!issue.isSubtask) return;
        const parentStory = issue.parentKey ? storyMap.get(issue.parentKey) : null;
        if (parentStory) {
            parentStory.subtasks.push(issue);
            return;
        }
        const fallbackEpic = getOrCreateEpic(issue.epicKey);
        fallbackEpic.stories.push({ ...issue, subtasks: [] });
    });

    const epics = Array.from(epicMap.values()).map((epic) => {
        const storyCount = epic.stories.length;
        const subtaskCount = epic.stories.reduce((sum, story) => sum + (story.subtasks?.length || 0), 0);
        return { ...epic, storyCount, subtaskCount };
    }).sort((a, b) => b.storyCount - a.storyCount);

    return { epics };
}

function buildTeamInsights(sprintSummaries) {
    const totals = {};
    sprintSummaries.forEach((sprint) => {
        Object.entries(sprint.assignees).forEach(([name, points]) => {
            totals[name] = (totals[name] || 0) + points;
        });
    });

    return Object.entries(totals)
        .map(([name, points]) => ({ name, points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 8);
}

function buildHeadline(activeSprint, sprintSummaries) {
    if (!activeSprint) return 'No active sprint found. Showing most recent sprint analytics.';
    if (activeSprint.completionPercent < 40) return 'Active sprint progress is low. Team may need scope/risk review.';
    if (activeSprint.completionPercent < 75) return 'Active sprint is progressing. Monitor blockers for on-time completion.';
    return 'Active sprint is on track based on current completion metrics.';
}

function normalizeIssues(rawIssues) {
    return (rawIssues || []).map((issue) => ({
        key: issue.key,
        fields: issue.fields || {}
    }));
}

function pickSprintFromIssue(issue) {
    const fields = issue.fields || {};
    const sprintCandidates = [];

    Object.entries(fields).forEach(([key, value]) => {
        if (!key.startsWith('customfield_') || !Array.isArray(value)) return;
        value.forEach((item) => {
            if (item && typeof item === 'object' && item.name && item.id) {
                sprintCandidates.push(item);
            }
        });
    });

    if (!sprintCandidates.length) return null;
    const active = sprintCandidates.find((s) => (s.state || '').toLowerCase() === 'active');
    return active || sprintCandidates[sprintCandidates.length - 1];
}

function buildPayloadFromIssues(issues, sourceLabel = 'jira-search') {
    const sprintMap = new Map();
    const sprintIssueBuckets = {};
    const hierarchyBySprint = {};
    const latestIssues = [];

    normalizeIssues(issues).forEach((issue) => {
        const sprint = pickSprintFromIssue(issue);
        if (sprint) {
            const sprintId = String(sprint.id);
            if (!sprintMap.has(sprintId)) {
                sprintMap.set(sprintId, {
                    id: sprint.id,
                    name: sprint.name || `Sprint ${sprint.id}`,
                    state: sprint.state || 'unknown',
                    startDate: toLocalDate(sprint.startDate),
                    endDate: toLocalDate(sprint.endDate),
                    _issues: []
                });
            }
            sprintMap.get(sprintId)._issues.push(issue);
        }

        latestIssues.push(formatIssue(issue));
    });

    let sprintSummaries = Array.from(sprintMap.values()).map((sprint) => {
        const summary = summarizeSprint(sprint, sprint._issues);
        const formatted = sprint._issues.map(formatIssue);
        sprintIssueBuckets[String(summary.id)] = formatted;
        hierarchyBySprint[String(summary.id)] = buildHierarchyFromIssues(formatted);
        delete sprint._issues;
        return summary;
    });

    sprintSummaries = sprintSummaries.sort((a, b) => {
        const aDate = new Date(a.endDate || 0).getTime();
        const bDate = new Date(b.endDate || 0).getTime();
        return bDate - aDate;
    }).slice(0, 5);

    const activeSprint = sprintSummaries.find((s) => (s.state || '').toLowerCase() === 'active') || sprintSummaries[0] || null;
    return {
        board: {
            id: null,
            name: sourceLabel,
            type: 'derived'
        },
        insight: buildHeadline(activeSprint, sprintSummaries),
        activeSprint,
        sprints: sprintSummaries,
        sprintIssueBuckets,
        hierarchyBySprint,
        teamWorkload: buildTeamInsights(sprintSummaries),
        issues: latestIssues.slice(0, 25),
        fetchedAt: new Date().toISOString()
    };
}

async function getIssueSearchFallbackPayload(baseUrl, headers) {
    const params = new URLSearchParams({
        jql: 'updated >= -60d ORDER BY updated DESC',
        maxResults: '100',
        fields: 'summary,status,issuetype,assignee,updated,created,resolutiondate,*all'
    });
    const searchResponse = await axios.get(`${baseUrl}/rest/api/3/search/jql?${params.toString()}`, { headers });
    const issues = searchResponse.data.issues || searchResponse.data.values || [];
    return buildPayloadFromIssues(issues, 'jira-search-fallback');
}

// 1. Endpoint to exchange the code for Jira Data
app.post('/api/get-jira-data', async (req, res) => {
    const { authCode } = req.body;
    console.error('[JIRA_API_DEBUG]', {
        context: 'get_jira_data_request_received',
        hasBody: Boolean(req.body),
        bodyKeys: req.body ? Object.keys(req.body) : [],
        hasAuthCode: Boolean(authCode),
        authCodeLength: typeof authCode === 'string' ? authCode.length : 0
    });

    try {
        if (!authCode || typeof authCode !== 'string') {
            console.error('[JIRA_API_DEBUG]', {
                context: 'get_jira_data_invalid_request',
                reason: 'Missing or invalid authCode in request body'
            });
            return res.status(400).json({
                success: false,
                error: 'Missing authCode in request body'
            });
        }

        // Step A: Exchange Auth Code for Access Token
        const tokenResponse = await axios.post('https://auth.atlassian.com/oauth/token', {
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: authCode,
            redirect_uri: REDIRECT_URI
        });
        const accessToken = tokenResponse.data.access_token;

        const cloudId = await getCloudId(accessToken);
        const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
        const headers = { Authorization: `Bearer ${accessToken}` };

        let payload;
        try {
            const board = await getBestBoard(baseUrl, headers);
            const sprints = await getRecentSprints(baseUrl, headers, board.id);
            const sprintSummaries = [];
            const sprintIssueBuckets = {};
            const hierarchyBySprint = {};
            const latestIssues = [];

            for (const sprint of sprints) {
                const sprintIssues = await getSprintIssues(baseUrl, headers, sprint.id);
                const summary = summarizeSprint(sprint, sprintIssues);
                sprintSummaries.push(summary);
                const formatted = sprintIssues.map(formatIssue);
                sprintIssueBuckets[String(summary.id)] = formatted;
                hierarchyBySprint[String(summary.id)] = buildHierarchyFromIssues(formatted);

                sprintIssues.slice(0, 20).forEach((issue) => {
                    latestIssues.push(formatIssue(issue));
                });
            }

            const uniqueIssues = Array.from(
                new Map(latestIssues.map((issue) => [issue.key, issue])).values()
            ).slice(0, 25);
            const activeSprint = sprintSummaries.find((sprint) => sprint.state === 'active') || sprintSummaries[0] || null;
            payload = {
                board: {
                    id: board.id,
                    name: board.name,
                    type: board.type
                },
                insight: buildHeadline(activeSprint, sprintSummaries),
                activeSprint,
                sprints: sprintSummaries,
                sprintIssueBuckets,
                hierarchyBySprint,
                teamWorkload: buildTeamInsights(sprintSummaries),
                issues: uniqueIssues,
                fetchedAt: new Date().toISOString()
            };
        } catch (agileError) {
            const agileDetails = agileError.response?.data || agileError.message;
            logAxiosError('agile_api_fallback', agileError, {
                fallback: 'jira_search',
                configuredScope: ATLASSIAN_SCOPE
            });
            console.warn('Agile API unavailable. Falling back to Jira search analytics.', agileDetails);
            payload = await getIssueSearchFallbackPayload(baseUrl, headers);
        }

        writeCache(payload);
        console.error('[JIRA_API_DEBUG]', {
            context: 'get_jira_data_success',
            board: payload.board?.name || null,
            sprintCount: Array.isArray(payload.sprints) ? payload.sprints.length : 0,
            issueCount: Array.isArray(payload.issues) ? payload.issues.length : 0,
            fetchedAt: payload.fetchedAt || null
        });
        res.json({ success: true, ...payload });

    } catch (error) {
        const jiraError = error.response ? error.response.data : error.message;
        logAxiosError('get_jira_data_failed', error, {
            configuredScope: ATLASSIAN_SCOPE
        });
        console.error("Jira API Error:", jiraError);
        res.status(500).json({ success: false, error: 'Failed to fetch real Jira data', details: jiraError });
    }
});

app.listen(3000, () => console.log('Backend running on http://localhost:3000'));

if (CLIENT_SECRET === 'YOUR_CLIENT_SECRET') {
    console.warn('Missing ATLASSIAN_CLIENT_SECRET. Set it before running the backend.');
}
