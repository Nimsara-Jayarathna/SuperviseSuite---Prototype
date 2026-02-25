(function () {
  var DB_KEY = "supervise_prototype_db_v1";
  var SESSION_KEY = "supervise_prototype_session";
  var FINALIZE_KEY = "ss_finalize_items_v1";

  var LIFECYCLE_STATUSES = ["DRAFT", "ACTIVE", "AT_RISK", "BEHIND", "COMPLETED", "ARCHIVED", "CANCELLED"];
  var ACTION_STATUSES = ["Todo", "In Progress", "Done"];
  var PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
  var INTEGRATION_STATUSES = ["NOT_CONFIGURED", "CONFIGURED", "CONNECTED", "ERROR"];
  var FINALIZE_MODULES = ["AUTH_SESSION", "ROLES_PERMISSIONS", "PROJECT_LIFECYCLE", "MEETINGS", "ACTION_ITEMS", "DASHBOARD_KPIS", "FILES", "INTEGRATIONS", "REPORTING_EXPORT"];
  var FINALIZE_STATUSES = ["OPEN", "DISCUSSING", "DECIDED", "DEFERRED"];
  var FINALIZE_PRIORITIES = ["MUST", "SHOULD", "COULD"];
  var FINALIZE_IMPACTS = ["HIGH", "MEDIUM", "LOW"];

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asPriority(value) {
    var upper = String(value || "").toUpperCase();
    return PRIORITIES.indexOf(upper) > -1 ? upper : "MEDIUM";
  }

  function lifecycleToLegacyStatus(status) {
    if (status === "AT_RISK") {
      return "At risk";
    }
    if (status === "BEHIND") {
      return "Behind";
    }
    if (status === "ACTIVE") {
      return "On track";
    }
    if (status === "COMPLETED") {
      return "On track";
    }
    if (status === "ARCHIVED") {
      return "On track";
    }
    if (status === "CANCELLED") {
      return "Behind";
    }
    return "On track";
  }

  function legacyToLifecycleStatus(status) {
    if (status === "At risk") {
      return "AT_RISK";
    }
    if (status === "Behind") {
      return "BEHIND";
    }
    if (status === "On track") {
      return "ACTIVE";
    }
    if (LIFECYCLE_STATUSES.indexOf(status) > -1) {
      return status;
    }
    return "DRAFT";
  }

  function isOverdueAction(item) {
    if (!item || !item.dueDate || item.status === "Done") {
      return false;
    }
    return new Date(item.dueDate) < new Date(todayIsoDate());
  }

  function isProjectMember(project, userId) {
    if (!project || !userId) {
      return false;
    }
    return safeArray(project.studentIds).indexOf(userId) > -1;
  }

  function ensureIntegrationModel(project) {
    project.githubIntegration = project.githubIntegration || {};
    project.jiraIntegration = project.jiraIntegration || {};
    project.commsIntegration = project.commsIntegration || {};

    project.githubUrl = String(project.githubUrl || project.githubIntegration.url || "").trim();
    project.jiraProjectKey = String(project.jiraProjectKey || project.jiraIntegration.projectKey || "").trim().toUpperCase();
    project.jiraBoardLink = String(project.jiraBoardLink || project.jiraIntegration.boardLink || "").trim();
    project.commsLink = String(project.commsLink || project.commsIntegration.link || "").trim();

    project.githubIntegration.url = project.githubUrl;
    project.jiraIntegration.projectKey = project.jiraProjectKey;
    project.jiraIntegration.boardLink = project.jiraBoardLink;
    project.commsIntegration.link = project.commsLink;

    project.githubIntegration.status = classifyGithubStatus(project.githubUrl);
    project.jiraIntegration.status = classifyJiraStatus(project.jiraProjectKey, project.jiraBoardLink);
    project.commsIntegration.status = classifyCommsStatus(project.commsLink);

    project.githubIntegration.error = project.githubIntegration.status === "ERROR" ? "Invalid GitHub repository URL." : "";
    project.jiraIntegration.error = project.jiraIntegration.status === "ERROR" ? "Invalid Jira project key or board URL." : "";
    project.commsIntegration.error = project.commsIntegration.status === "ERROR" ? "Invalid communication link." : "";
  }

  function classifyGithubStatus(url) {
    var value = String(url || "").trim();
    if (!value) {
      return "NOT_CONFIGURED";
    }
    return /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(value) ? "CONNECTED" : "ERROR";
  }

  function classifyJiraStatus(projectKey, boardLink) {
    var key = String(projectKey || "").trim();
    var board = String(boardLink || "").trim();

    if (!key && !board) {
      return "NOT_CONFIGURED";
    }

    if (key && !/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
      return "ERROR";
    }

    if (board && !/^https?:\/\/[\w.-]*jira[\w.-]*\//i.test(board)) {
      return "ERROR";
    }

    if (key) {
      return "CONNECTED";
    }

    return "CONFIGURED";
  }

  function classifyCommsStatus(link) {
    var value = String(link || "").trim();
    if (!value) {
      return "NOT_CONFIGURED";
    }
    return /^https?:\/\/(meet\.google\.com|zoom\.us|teams\.microsoft\.com|discord\.com|chat\.whatsapp\.com)\//i.test(value) ? "CONNECTED" : "ERROR";
  }

  function normalizeActionItem(action, db) {
    var created = String(action.createdAt || nowIso());
    var assignee = action.assigneeId || action.ownerId || "";
    action.assigneeId = assignee;
    action.ownerId = assignee;
    action.priority = asPriority(action.priority);
    action.status = ACTION_STATUSES.indexOf(action.status) > -1 ? action.status : "Todo";
    action.createdFromMeetingId = action.createdFromMeetingId || action.meetingId || null;
    action.lastUpdatedAt = action.lastUpdatedAt || created;
    action.lastUpdatedBy = action.lastUpdatedBy || action.ownerId || null;
    action.evidenceLink = String(action.evidenceLink || "").trim();
    action.comments = safeArray(action.comments);
    action.notes = safeArray(action.notes);
    action.isOfficial = action.isOfficial === true;
    action.fieldsLocked = action.fieldsLocked === true;
    action.createdAt = created;

    if (!action.dueDate) {
      action.dueDate = todayIsoDate();
    }

    if (db && db.projects) {
      var project = db.projects.find(function (p) { return p.id === action.projectId; });
      if (project && !isProjectMember(project, action.assigneeId)) {
        action.assigneeId = safeArray(project.studentIds)[0] || action.assigneeId;
        action.ownerId = action.assigneeId;
      }
    }

    return action;
  }

  function normalizeMeeting(meeting) {
    meeting.status = ["DRAFT", "SUBMITTED", "APPROVED"].indexOf(meeting.status) > -1 ? meeting.status : "DRAFT";
    meeting.createdAt = meeting.createdAt || nowIso();
    meeting.createdBy = meeting.createdBy || null;
    meeting.submittedAt = meeting.submittedAt || null;
    meeting.submittedBy = meeting.submittedBy || null;
    meeting.approvedAt = meeting.approvedAt || null;
    meeting.approvedBy = meeting.approvedBy || null;
    meeting.actionItemIds = safeArray(meeting.actionItemIds);
    return meeting;
  }

  function recomputeProjectDerived(project, db) {
    var actions = db.actionItems.filter(function (a) { return a.projectId === project.id; });
    var overdueCount = actions.filter(isOverdueAction).length;
    var suggested = null;

    if (project.milestoneDate && new Date(project.milestoneDate) < new Date(todayIsoDate()) && overdueCount > 0) {
      suggested = "BEHIND";
    } else if (overdueCount >= 2) {
      suggested = "AT_RISK";
    }

    project.overdueCount = overdueCount;
    project.healthSuggestedStatus = suggested;
    project.openActionItems = actions.filter(function (a) { return a.status !== "Done"; }).length;
    project.meetingCount = db.meetings.filter(function (m) { return m.projectId === project.id; }).length;
    project.analytics = project.analytics || {};
    project.analytics.lastActivityAt = project.analytics.lastActivityAt || nowIso();
    project.analytics.activityWeeks = safeArray(project.analytics.activityWeeks);

    while (project.analytics.activityWeeks.length < 6) {
      project.analytics.activityWeeks.push(0);
    }

    if (project.analytics.activityWeeks.length > 6) {
      project.analytics.activityWeeks = project.analytics.activityWeeks.slice(-6);
    }

    project.status = lifecycleToLegacyStatus(project.lifecycleStatus);
  }

  function normalizeProject(project, db) {
    project.title = project.title || "Untitled Project";
    project.studentIds = safeArray(project.studentIds);
    project.lifecycleStatus = legacyToLifecycleStatus(project.lifecycleStatus || project.status);
    project.createdAt = project.createdAt || nowIso();
    project.createdBy = project.createdBy || null;
    project.auditEvents = safeArray(project.auditEvents);
    project.overdueCount = typeof project.overdueCount === "number" ? project.overdueCount : 0;
    project.healthSuggestedStatus = project.healthSuggestedStatus || null;
    project.meetingCount = typeof project.meetingCount === "number" ? project.meetingCount : 0;
    project.openActionItems = typeof project.openActionItems === "number" ? project.openActionItems : 0;

    project.analytics = project.analytics || {
      commitsWeek: 0,
      openIssues: 0,
      jiraTodo: 0,
      jiraInProgress: 0,
      jiraDone: 0,
      lastActivityAt: nowIso(),
      activityWeeks: [0, 0, 0, 0, 0, 0],
      contributions: []
    };

    project.analytics.contributions = safeArray(project.analytics.contributions);
    if (!project.analytics.contributions.length && project.studentIds.length) {
      project.analytics.contributions = project.studentIds.map(function (sid) {
        return { userId: sid, commits: 0, prs: 0 };
      });
    }

    ensureIntegrationModel(project);
    recomputeProjectDerived(project, db);
    return project;
  }

  function normalizeDb(db) {
    if (!db.users) {
      db.users = [];
    }
    if (!db.projects) {
      db.projects = [];
    }
    if (!db.meetings) {
      db.meetings = [];
    }
    if (!db.actionItems) {
      db.actionItems = [];
    }
    if (!db.files) {
      db.files = [];
    }

    db.users.forEach(function (u) {
      if (!u.name && u.fullName) {
        u.name = u.fullName;
      }
      if (!u.fullName && u.name) {
        u.fullName = u.name;
      }
      if (!u.createdAt) {
        u.createdAt = nowIso();
      }
    });

    db.projects.forEach(function (p) {
      normalizeProject(p, db);
    });

    db.meetings.forEach(function (m) {
      normalizeMeeting(m);
    });

    db.actionItems.forEach(function (a) {
      normalizeActionItem(a, db);
    });
  }

  function loadFinalizeItems() {
    var raw = localStorage.getItem(FINALIZE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveFinalizeItems(items) {
    localStorage.setItem(FINALIZE_KEY, JSON.stringify(items));
    return items;
  }

  function normalizeFinalizeItem(item) {
    var now = nowIso();
    item = item || {};
    var createdAt = item.createdAt || now;
    var status = FINALIZE_STATUSES.indexOf(item.status) > -1 ? item.status : "OPEN";
    var decidedAt = item.decidedAt || null;
    if (status === "DECIDED" && !decidedAt) {
      decidedAt = now;
    }
    if (status !== "DECIDED") {
      decidedAt = null;
    }
    return {
      id: item.id || ("fin_" + Date.now() + "_" + Math.floor(Math.random() * 10000)),
      module: FINALIZE_MODULES.indexOf(item.module) > -1 ? item.module : "REPORTING_EXPORT",
      title: String(item.title || "").trim(),
      businessIntent: String(item.businessIntent || "").trim(),
      currentImplementation: String(item.currentImplementation || "").trim(),
      riskPrevented: String(item.riskPrevented || "").trim(),
      alternatives: safeArray(item.alternatives).map(function (a) { return String(a || "").trim(); }).filter(Boolean),
      clientDecision: String(item.clientDecision || "").trim(),
      status: status,
      priority: FINALIZE_PRIORITIES.indexOf(item.priority) > -1 ? item.priority : "SHOULD",
      impact: FINALIZE_IMPACTS.indexOf(item.impact) > -1 ? item.impact : "MEDIUM",
      owner: item.owner === "TEAM" ? "TEAM" : "CLIENT",
      createdAt: createdAt,
      updatedAt: item.updatedAt || createdAt,
      decidedAt: decidedAt,
      updatedByUserId: item.updatedByUserId || null
    };
  }

  function ensureFinalizeItemsSeeded() {
    var existing = loadFinalizeItems();
    if (existing && Array.isArray(existing)) {
      var normalizedExisting = existing.map(normalizeFinalizeItem);
      saveFinalizeItems(normalizedExisting);
      return normalizedExisting;
    }
    var seed = window.Seed && window.Seed.generateFinalizeSeedItems ? window.Seed.generateFinalizeSeedItems() : [];
    var normalizedSeed = safeArray(seed).map(normalizeFinalizeItem);
    saveFinalizeItems(normalizedSeed);
    return normalizedSeed;
  }

  function getFinalizeItems() {
    return clone(ensureFinalizeItemsSeeded()).sort(function (a, b) {
      var moduleCmp = FINALIZE_MODULES.indexOf(a.module) - FINALIZE_MODULES.indexOf(b.module);
      if (moduleCmp !== 0) {
        return moduleCmp;
      }
      var statusCmp = FINALIZE_STATUSES.indexOf(a.status) - FINALIZE_STATUSES.indexOf(b.status);
      if (statusCmp !== 0) {
        return statusCmp;
      }
      var priorityCmp = FINALIZE_PRIORITIES.indexOf(a.priority) - FINALIZE_PRIORITIES.indexOf(b.priority);
      if (priorityCmp !== 0) {
        return priorityCmp;
      }
      return a.title.localeCompare(b.title);
    });
  }

  function resolveUser(userOrId) {
    if (!userOrId) {
      return null;
    }
    if (typeof userOrId === "string") {
      return getUserById(userOrId);
    }
    if (userOrId.id) {
      return getUserById(userOrId.id) || userOrId;
    }
    return null;
  }

  function canManageFinalize(userOrId) {
    var user = resolveUser(userOrId);
    return !!(user && user.role === "SUPERVISOR");
  }

  function addFinalizeItem(payload, userOrId) {
    if (!canManageFinalize(userOrId)) {
      return { ok: false, message: "Only supervisors can add finalize items." };
    }
    var user = resolveUser(userOrId);
    if (!payload || !payload.module || !payload.title) {
      return { ok: false, message: "Module and title are required." };
    }
    var items = ensureFinalizeItemsSeeded();
    var now = nowIso();
    var newItem = normalizeFinalizeItem({
      id: "fin_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      module: payload.module,
      title: payload.title,
      businessIntent: payload.businessIntent || "",
      currentImplementation: payload.currentImplementation || "",
      riskPrevented: payload.riskPrevented || "",
      alternatives: payload.alternatives || [],
      clientDecision: payload.clientDecision || "",
      status: payload.status || "OPEN",
      priority: payload.priority || "SHOULD",
      impact: payload.impact || "MEDIUM",
      owner: payload.owner || "CLIENT",
      createdAt: now,
      updatedAt: now,
      decidedAt: null,
      updatedByUserId: user ? user.id : null
    });
    items.push(newItem);
    saveFinalizeItems(items);
    return { ok: true, item: clone(newItem) };
  }

  function updateFinalizeItem(id, patch, userOrId) {
    if (!canManageFinalize(userOrId)) {
      return { ok: false, message: "Only supervisors can edit finalize items." };
    }
    var user = resolveUser(userOrId);
    var items = ensureFinalizeItemsSeeded();
    var idx = items.findIndex(function (item) { return item.id === id; });
    if (idx === -1) {
      return { ok: false, message: "Finalize item not found." };
    }
    var current = items[idx];
    var next = {
      id: current.id,
      module: patch.module !== undefined ? patch.module : current.module,
      title: patch.title !== undefined ? patch.title : current.title,
      businessIntent: patch.businessIntent !== undefined ? patch.businessIntent : current.businessIntent,
      currentImplementation: patch.currentImplementation !== undefined ? patch.currentImplementation : current.currentImplementation,
      riskPrevented: patch.riskPrevented !== undefined ? patch.riskPrevented : current.riskPrevented,
      alternatives: patch.alternatives !== undefined ? patch.alternatives : current.alternatives,
      clientDecision: patch.clientDecision !== undefined ? patch.clientDecision : current.clientDecision,
      status: patch.status !== undefined ? patch.status : current.status,
      priority: patch.priority !== undefined ? patch.priority : current.priority,
      impact: patch.impact !== undefined ? patch.impact : current.impact,
      owner: patch.owner !== undefined ? patch.owner : current.owner,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
      decidedAt: current.decidedAt,
      updatedByUserId: user ? user.id : null
    };
    if (next.status === "DECIDED") {
      next.decidedAt = current.decidedAt || nowIso();
    } else {
      next.decidedAt = null;
    }
    items[idx] = normalizeFinalizeItem(next);
    saveFinalizeItems(items);
    return { ok: true, item: clone(items[idx]) };
  }

  function deleteFinalizeItem(id, userOrId) {
    if (!canManageFinalize(userOrId)) {
      return { ok: false, message: "Only supervisors can delete finalize items." };
    }
    var items = ensureFinalizeItemsSeeded();
    var next = items.filter(function (item) { return item.id !== id; });
    if (next.length === items.length) {
      return { ok: false, message: "Finalize item not found." };
    }
    saveFinalizeItems(next);
    return { ok: true };
  }

  function sortedFinalize(items) {
    return safeArray(items).slice().sort(function (a, b) {
      var moduleCmp = FINALIZE_MODULES.indexOf(a.module) - FINALIZE_MODULES.indexOf(b.module);
      if (moduleCmp !== 0) {
        return moduleCmp;
      }
      var statusCmp = FINALIZE_STATUSES.indexOf(a.status) - FINALIZE_STATUSES.indexOf(b.status);
      if (statusCmp !== 0) {
        return statusCmp;
      }
      var priorityCmp = FINALIZE_PRIORITIES.indexOf(a.priority) - FINALIZE_PRIORITIES.indexOf(b.priority);
      if (priorityCmp !== 0) {
        return priorityCmp;
      }
      return a.title.localeCompare(b.title);
    });
  }

  function exportFinalizeItems(format, itemsOverride) {
    var items = sortedFinalize(itemsOverride && Array.isArray(itemsOverride) ? itemsOverride : getFinalizeItems());
    if ((format || "json") === "text") {
      var lines = [];
      var grouped = {};
      items.forEach(function (item) {
        grouped[item.module] = grouped[item.module] || [];
        grouped[item.module].push(item);
      });
      FINALIZE_MODULES.forEach(function (module) {
        if (!grouped[module] || !grouped[module].length) {
          return;
        }
        lines.push("## " + module);
        grouped[module].forEach(function (item) {
          lines.push("- [" + item.status + "] [" + item.priority + "/" + item.impact + "] " + item.title);
          lines.push("  Current implementation: " + (item.currentImplementation || "-"));
          lines.push("  Decision: " + (item.clientDecision || ""));
        });
        lines.push("");
      });
      return lines.join("\n").trim();
    }
    return JSON.stringify(items, null, 2);
  }

  function getFinalizeStats() {
    var items = getFinalizeItems();
    var stats = {
      openCount: 0,
      discussingCount: 0,
      decidedCount: 0,
      deferredCount: 0,
      total: items.length
    };
    items.forEach(function (item) {
      if (item.status === "OPEN") {
        stats.openCount += 1;
      } else if (item.status === "DISCUSSING") {
        stats.discussingCount += 1;
      } else if (item.status === "DECIDED") {
        stats.decidedCount += 1;
      } else if (item.status === "DEFERRED") {
        stats.deferredCount += 1;
      }
    });
    return stats;
  }

  function resetFinalizeItems(userOrId) {
    if (!canManageFinalize(userOrId)) {
      return { ok: false, message: "Only supervisors can reset finalize items." };
    }
    localStorage.removeItem(FINALIZE_KEY);
    ensureFinalizeItemsSeeded();
    return { ok: true, items: getFinalizeItems() };
  }

  function loadDB() {
    var raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  function init() {
    var db = loadDB();
    if (!db || !db.users || !db.projects) {
      db = window.Seed.generateSeedData();
    }
    normalizeDb(db);
    saveDB(db);
    ensureFinalizeItemsSeeded();
    return db;
  }

  function getSession() {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    var now = nowIso();
    var normalized = {
      userId: session && session.userId ? session.userId : null,
      role: session && session.role ? session.role : null,
      createdAt: session && session.createdAt ? session.createdAt : now,
      lastActiveAt: session && session.lastActiveAt ? session.lastActiveAt : now,
      returnTo: session && session.returnTo ? session.returnTo : null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    return clone(normalized);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getUserById(id) {
    return init().users.find(function (u) { return u.id === id; }) || null;
  }

  function login(email, password) {
    var db = init();
    var existing = getSession();
    var user = db.users.find(function (u) {
      return u.email.toLowerCase() === email.toLowerCase() && u.password === password;
    });
    if (!user) {
      return null;
    }
    var now = nowIso();
    return setSession({
      userId: user.id,
      role: user.role,
      createdAt: now,
      lastActiveAt: now,
      returnTo: existing && existing.returnTo ? existing.returnTo : null
    });
  }

  function getCurrentUser() {
    var session = getSession();
    if (!session || !session.userId) {
      return null;
    }
    return getUserById(session.userId);
  }

  function emailExists(email) {
    if (!email) {
      return false;
    }
    var normalized = String(email).trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return init().users.some(function (u) {
      return String(u.email || "").toLowerCase() === normalized;
    });
  }

  function registerUser(payload) {
    var db = init();
    var fullName = String(payload.fullName || payload.full_name || "").trim();
    var email = String(payload.email || "").trim().toLowerCase();
    var password = String(payload.password || "");
    var role = payload.role === "SUPERVISOR" ? "SUPERVISOR" : "STUDENT";

    if (!fullName || !email || !password) {
      return { ok: false, error: "Missing required fields" };
    }

    if (emailExists(email)) {
      return { ok: false, error: "Email already registered" };
    }

    var rec = {
      id: "u_reg_" + Date.now(),
      name: fullName,
      fullName: fullName,
      email: email,
      password: password,
      role: role,
      createdAt: nowIso()
    };
    db.users.push(rec);
    saveDB(db);
    return { ok: true, user: clone(rec) };
  }

  function touchSession() {
    var session = getSession();
    if (!session || !session.userId) {
      return null;
    }
    session.lastActiveAt = nowIso();
    return setSession(session);
  }

  function getProjectsForUser(user) {
    var db = init();
    if (!user) {
      return [];
    }
    if (user.role === "SUPERVISOR") {
      return clone(db.projects);
    }
    return clone(db.projects.filter(function (p) {
      return p.studentIds.indexOf(user.id) > -1;
    }));
  }

  function getProjectById(id) {
    var db = init();
    return clone(db.projects.find(function (p) { return p.id === id; }) || null);
  }

  function addAuditEventInternal(db, projectId, type, byUserId, meta) {
    var project = db.projects.find(function (p) { return p.id === projectId; });
    if (!project) {
      return null;
    }
    var event = {
      id: "ev_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      timestamp: nowIso(),
      type: type,
      byUserId: byUserId || null,
      meta: meta || {}
    };
    project.auditEvents = safeArray(project.auditEvents);
    project.auditEvents.push(event);
    project.analytics.lastActivityAt = event.timestamp;
    return event;
  }

  function addAuditEvent(projectId, type, byUserId, meta) {
    var db = init();
    var event = addAuditEventInternal(db, projectId, type, byUserId, meta);
    if (!event) {
      return null;
    }
    saveDB(db);
    return clone(event);
  }

  function canTransitionProjectStatus(userRole, fromStatus, toStatus) {
    if (LIFECYCLE_STATUSES.indexOf(fromStatus) === -1 || LIFECYCLE_STATUSES.indexOf(toStatus) === -1) {
      return false;
    }

    if (userRole !== "SUPERVISOR") {
      return false;
    }

    var transitions = {
      DRAFT: ["ACTIVE", "AT_RISK", "BEHIND", "CANCELLED"],
      ACTIVE: ["AT_RISK", "BEHIND", "COMPLETED", "CANCELLED"],
      AT_RISK: ["ACTIVE", "BEHIND", "COMPLETED", "CANCELLED"],
      BEHIND: ["ACTIVE", "AT_RISK", "COMPLETED", "CANCELLED"],
      COMPLETED: ["ARCHIVED"],
      ARCHIVED: [],
      CANCELLED: ["ARCHIVED"]
    };

    if (fromStatus === toStatus) {
      return true;
    }

    if (safeArray(transitions[fromStatus]).indexOf(toStatus) === -1) {
      return false;
    }

    return true;
  }

  function applyProjectStatusTransition(projectId, toStatus, userId) {
    var db = init();
    var project = db.projects.find(function (p) { return p.id === projectId; });
    var user = db.users.find(function (u) { return u.id === userId; });

    if (!project || !user) {
      return { ok: false, message: "Project or user not found." };
    }

    if (!canTransitionProjectStatus(user.role, project.lifecycleStatus, toStatus)) {
      return { ok: false, message: "Invalid status transition for your role." };
    }

    if (project.lifecycleStatus === "DRAFT" && toStatus === "ACTIVE" && project.commsIntegration.status !== "CONNECTED") {
      return { ok: false, message: "Communication integration must be connected before activating." };
    }

    if (toStatus === "ARCHIVED" && ["COMPLETED", "CANCELLED"].indexOf(project.lifecycleStatus) === -1) {
      return { ok: false, message: "Archive is allowed only after completion or cancellation." };
    }

    var fromStatus = project.lifecycleStatus;
    project.lifecycleStatus = toStatus;
    project.status = lifecycleToLegacyStatus(toStatus);
    project.analytics.lastActivityAt = nowIso();

    addAuditEventInternal(db, projectId, "STATUS_CHANGED", userId, {
      fromStatus: fromStatus,
      toStatus: toStatus
    });

    recomputeProjectDerived(project, db);
    saveDB(db);
    return { ok: true, project: clone(project) };
  }

  function upsertProject(project, actorId) {
    var db = init();
    var idx = db.projects.findIndex(function (p) { return p.id === project.id; });
    normalizeProject(project, db);

    if (idx === -1) {
      db.projects.push(project);
    } else {
      db.projects[idx] = project;
    }

    addAuditEventInternal(db, project.id, "INTEGRATION_UPDATED", actorId || project.createdBy || null, {
      githubStatus: project.githubIntegration.status,
      jiraStatus: project.jiraIntegration.status,
      commsStatus: project.commsIntegration.status
    });

    saveDB(db);
    return clone(project);
  }

  function createProject(payload, userId) {
    var db = init();
    var p = {
      id: "p_" + Date.now(),
      title: payload.title,
      batch: payload.batch,
      semester: payload.semester,
      milestoneDate: payload.milestoneDate,
      studentIds: safeArray(payload.studentIds),
      lifecycleStatus: "DRAFT",
      status: "On track",
      githubUrl: payload.githubUrl || "",
      jiraProjectKey: payload.jiraProjectKey || "",
      jiraBoardLink: payload.jiraBoardLink || "",
      commsLink: payload.commsLink || "",
      createdAt: nowIso(),
      createdBy: userId,
      overdueCount: 0,
      healthSuggestedStatus: null,
      openActionItems: 0,
      meetingCount: 0,
      auditEvents: [],
      analytics: {
        commitsWeek: 0,
        openIssues: 0,
        jiraTodo: 0,
        jiraInProgress: 0,
        jiraDone: 0,
        lastActivityAt: nowIso(),
        activityWeeks: [0, 0, 0, 0, 0, 0],
        contributions: safeArray(payload.studentIds).map(function (sid) {
          return { userId: sid, commits: 0, prs: 0 };
        })
      }
    };

    normalizeProject(p, db);
    db.projects.push(p);

    addAuditEventInternal(db, p.id, "PROJECT_CREATED", userId, {
      lifecycleStatus: p.lifecycleStatus,
      title: p.title
    });

    saveDB(db);
    return clone(p);
  }

  function listMeetings(projectId) {
    var db = init();
    return clone(db.meetings.filter(function (m) { return m.projectId === projectId; }))
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

  function listActionItems(projectId) {
    var db = init();
    return clone(db.actionItems.filter(function (a) { return a.projectId === projectId; }))
      .map(function (a) {
        a.isOverdue = isOverdueAction(a);
        return a;
      })
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });
  }

  function listFiles(projectId) {
    var db = init();
    return clone(db.files.filter(function (f) { return f.projectId === projectId; }))
      .sort(function (a, b) { return new Date(b.uploadedAt) - new Date(a.uploadedAt); });
  }

  function canEditActionItem(user, actionItem, project) {
    if (!user || !actionItem || !project) {
      return false;
    }
    if (user.role === "SUPERVISOR") {
      return true;
    }
    return user.role === "STUDENT" && isProjectMember(project, user.id) && actionItem.assigneeId === user.id;
  }

  function validateActionItemTransition(actionItem, toStatus, payload) {
    if (ACTION_STATUSES.indexOf(toStatus) === -1) {
      return { ok: false, message: "Unsupported action item status." };
    }

    if (toStatus === "Done") {
      var comment = String((payload && payload.comment) || "").trim();
      var evidence = String((payload && payload.evidenceLink) || actionItem.evidenceLink || "").trim();
      if (!comment && !evidence) {
        return { ok: false, message: "Marking as Done requires a comment or evidence link." };
      }
    }

    return { ok: true, message: "ok" };
  }

  function appendActionComment(item, actorId, commentText) {
    var text = String(commentText || "").trim();
    if (!text) {
      return;
    }
    item.comments = safeArray(item.comments);
    item.notes = safeArray(item.notes);
    var entry = {
      id: "note_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      text: text,
      byUserId: actorId || null,
      createdAt: nowIso()
    };
    item.comments.push(entry);
    item.notes.push(entry);
  }

  function updateActionItemStatus(actionId, status, actorId, payload) {
    var db = init();
    var item = db.actionItems.find(function (a) { return a.id === actionId; });
    if (!item) {
      return { ok: false, message: "Action item not found." };
    }

    var project = db.projects.find(function (p) { return p.id === item.projectId; });
    var actor = db.users.find(function (u) { return u.id === actorId; });

    if (actorId && !canEditActionItem(actor, item, project)) {
      return { ok: false, message: "You cannot edit this action item." };
    }

    var transition = validateActionItemTransition(item, status, payload || {});
    if (!transition.ok) {
      return transition;
    }

    item.status = status;
    if (payload && payload.evidenceLink) {
      item.evidenceLink = String(payload.evidenceLink).trim();
    }
    appendActionComment(item, actorId, payload && payload.comment);
    item.lastUpdatedAt = nowIso();
    item.lastUpdatedBy = actorId || item.lastUpdatedBy;

    if (project) {
      recomputeProjectDerived(project, db);
      addAuditEventInternal(db, project.id, "ACTION_STATUS_CHANGED", actorId || null, {
        actionId: item.id,
        status: status
      });
    }

    saveDB(db);
    return { ok: true, item: clone(item) };
  }

  function updateActionItem(actionId, payload, actorId) {
    var db = init();
    var item = db.actionItems.find(function (a) { return a.id === actionId; });
    if (!item) {
      return { ok: false, message: "Action item not found." };
    }

    var project = db.projects.find(function (p) { return p.id === item.projectId; });
    var actor = db.users.find(function (u) { return u.id === actorId; });

    if (!canEditActionItem(actor, item, project)) {
      return { ok: false, message: "You cannot edit this action item." };
    }

    if (item.fieldsLocked) {
      if (payload.assigneeId || payload.dueDate || payload.priority || payload.description) {
        return { ok: false, message: "This approved meeting action item has locked fields." };
      }
    }

    if (payload.assigneeId) {
      if (!isProjectMember(project, payload.assigneeId)) {
        return { ok: false, message: "Assignee must be a student in this project." };
      }
      item.assigneeId = payload.assigneeId;
      item.ownerId = payload.assigneeId;
    }

    if (payload.dueDate) {
      item.dueDate = payload.dueDate;
    }

    if (payload.priority) {
      item.priority = asPriority(payload.priority);
    }

    if (payload.description) {
      item.description = String(payload.description).trim();
    }

    if (payload.evidenceLink !== undefined) {
      item.evidenceLink = String(payload.evidenceLink || "").trim();
    }

    appendActionComment(item, actorId, payload.comment);

    item.lastUpdatedAt = nowIso();
    item.lastUpdatedBy = actorId;

    recomputeProjectDerived(project, db);
    saveDB(db);
    return { ok: true, item: clone(item) };
  }

  function linkActionItemJira(actionId, jiraData, actorId) {
    var db = init();
    var item = db.actionItems.find(function (a) { return a.id === actionId; });
    if (!item) {
      return { ok: false, message: "Action item not found." };
    }

    var project = db.projects.find(function (p) { return p.id === item.projectId; });
    var actor = db.users.find(function (u) { return u.id === actorId; });

    if (actorId && !canEditActionItem(actor, item, project)) {
      return { ok: false, message: "You cannot link Jira for this action item." };
    }

    item.jira = jiraData;
    item.lastUpdatedAt = nowIso();
    item.lastUpdatedBy = actorId || item.lastUpdatedBy;

    saveDB(db);
    return { ok: true, item: clone(item) };
  }

  function createMockJiraForAction(actionId, projectId, actorId) {
    var db = init();
    var project = db.projects.find(function (p) { return p.id === projectId; });
    var action = db.actionItems.find(function (a) { return a.id === actionId; });
    var actor = db.users.find(function (u) { return u.id === actorId; });

    if (!project || !action || !project.jiraProjectKey) {
      return { ok: false, message: "Jira is not configured for this project." };
    }

    if (actorId && !canEditActionItem(actor, action, project)) {
      return { ok: false, message: "You cannot create Jira for this action item." };
    }

    var num = Math.floor(100 + Math.random() * 900);
    var key = project.jiraProjectKey + "-" + num;
    action.jira = {
      key: key,
      url: "https://jira.example.com/browse/" + key
    };
    action.lastUpdatedAt = nowIso();
    action.lastUpdatedBy = actorId || action.lastUpdatedBy;
    project.analytics.openIssues += 1;

    saveDB(db);
    return { ok: true, item: clone(action) };
  }

  function ensureActionItemInput(project, rawAction) {
    var assignee = rawAction.assigneeId || rawAction.ownerId;
    var due = rawAction.dueDate;

    if (!rawAction.description || !String(rawAction.description).trim()) {
      return { ok: false, message: "Action item description is required." };
    }

    if (!assignee) {
      return { ok: false, message: "Action item assignee is required." };
    }

    if (!isProjectMember(project, assignee)) {
      return { ok: false, message: "Assignee must be part of the project." };
    }

    if (!due) {
      return { ok: false, message: "Action item due date is required." };
    }

    return { ok: true };
  }

  function createMeeting(projectId, meetingPayload, userId) {
    var db = init();
    var project = db.projects.find(function (p) { return p.id === projectId; });
    var user = db.users.find(function (u) { return u.id === userId; });

    if (!project || !user) {
      return { ok: false, message: "Project or user not found." };
    }

    if (user.role !== "SUPERVISOR" && !isProjectMember(project, userId)) {
      return { ok: false, message: "You are not allowed to create meetings for this project." };
    }

    if (!meetingPayload.title || !meetingPayload.date || !meetingPayload.summary) {
      return { ok: false, message: "Meeting title, date and summary are required." };
    }

    var meetingId = "m_" + Date.now();
    var actionIds = [];
    var rawActions = safeArray(meetingPayload.actionItems);

    for (var i = 0; i < rawActions.length; i += 1) {
      var raw = rawActions[i];
      var validation = ensureActionItemInput(project, raw);
      if (!validation.ok) {
        return validation;
      }

      var actionId = "a_" + Date.now() + "_" + i;
      var createdAt = nowIso();

      db.actionItems.push(normalizeActionItem({
        id: actionId,
        projectId: projectId,
        meetingId: meetingId,
        createdFromMeetingId: meetingId,
        description: String(raw.description).trim(),
        assigneeId: raw.assigneeId || raw.ownerId,
        ownerId: raw.assigneeId || raw.ownerId,
        dueDate: raw.dueDate,
        priority: raw.priority || "MEDIUM",
        status: "Todo",
        jira: raw.jira || null,
        evidenceLink: raw.evidenceLink || "",
        comments: [],
        notes: [],
        createdAt: createdAt,
        lastUpdatedAt: createdAt,
        lastUpdatedBy: userId,
        isOfficial: false,
        fieldsLocked: false
      }, db));

      actionIds.push(actionId);
      addAuditEventInternal(db, projectId, "ACTION_CREATED", userId, {
        actionId: actionId,
        fromMeetingId: meetingId
      });
    }

    db.meetings.push(normalizeMeeting({
      id: meetingId,
      projectId: projectId,
      title: meetingPayload.title,
      date: meetingPayload.date,
      summary: meetingPayload.summary,
      decisions: meetingPayload.decisions || "",
      actionItemIds: actionIds,
      status: "DRAFT",
      createdAt: nowIso(),
      createdBy: userId
    }));

    project.analytics.lastActivityAt = nowIso();
    project.analytics.activityWeeks[5] += actionIds.length;
    project.analytics.commitsWeek += 1;
    recomputeProjectDerived(project, db);

    addAuditEventInternal(db, projectId, "MEETING_CREATED", userId, {
      meetingId: meetingId,
      actionCount: actionIds.length
    });

    saveDB(db);
    return { ok: true, meetingId: meetingId, actionIds: actionIds };
  }

  function submitMeeting(projectId, meetingId, userId) {
    var db = init();
    var project = db.projects.find(function (p) { return p.id === projectId; });
    var meeting = db.meetings.find(function (m) { return m.id === meetingId && m.projectId === projectId; });
    var user = db.users.find(function (u) { return u.id === userId; });

    if (!project || !meeting || !user) {
      return { ok: false, message: "Project, meeting, or user not found." };
    }

    if (meeting.status !== "DRAFT") {
      return { ok: false, message: "Only draft meetings can be submitted." };
    }

    if (user.role !== "SUPERVISOR" && !isProjectMember(project, userId)) {
      return { ok: false, message: "Only project members can submit this meeting." };
    }

    meeting.status = "SUBMITTED";
    meeting.submittedAt = nowIso();
    meeting.submittedBy = userId;

    addAuditEventInternal(db, projectId, "MEETING_SUBMITTED", userId, {
      meetingId: meetingId
    });

    saveDB(db);
    return { ok: true, meeting: clone(meeting) };
  }

  function approveMeeting(projectId, meetingId, userId) {
    var db = init();
    var project = db.projects.find(function (p) { return p.id === projectId; });
    var meeting = db.meetings.find(function (m) { return m.id === meetingId && m.projectId === projectId; });
    var user = db.users.find(function (u) { return u.id === userId; });

    if (!project || !meeting || !user) {
      return { ok: false, message: "Project, meeting, or user not found." };
    }

    if (user.role !== "SUPERVISOR") {
      return { ok: false, message: "Only supervisors can approve meetings." };
    }

    if (meeting.status !== "SUBMITTED") {
      return { ok: false, message: "Only submitted meetings can be approved." };
    }

    meeting.status = "APPROVED";
    meeting.approvedAt = nowIso();
    meeting.approvedBy = userId;

    db.actionItems.forEach(function (a) {
      if (a.projectId === projectId && a.createdFromMeetingId === meetingId) {
        a.isOfficial = true;
        a.fieldsLocked = true;
        a.lastUpdatedAt = nowIso();
        a.lastUpdatedBy = userId;
      }
    });

    recomputeProjectDerived(project, db);

    addAuditEventInternal(db, projectId, "MEETING_APPROVED", userId, {
      meetingId: meetingId
    });

    saveDB(db);
    return { ok: true, meeting: clone(meeting) };
  }

  function addMeeting(projectId, meetingData, actionData, userId) {
    var payload = {
      title: meetingData.title,
      date: meetingData.date,
      summary: meetingData.summary,
      decisions: meetingData.decisions,
      actionItems: safeArray(actionData).map(function (item) {
        return {
          description: item.description,
          assigneeId: item.assigneeId || item.ownerId,
          ownerId: item.assigneeId || item.ownerId,
          dueDate: item.dueDate,
          priority: item.priority,
          jira: item.jira || null
        };
      })
    };
    return createMeeting(projectId, payload, userId);
  }

  function updateProjectIntegrations(projectId, payload, actorId) {
    var db = init();
    var project = db.projects.find(function (p) { return p.id === projectId; });

    if (!project) {
      return { ok: false, message: "Project not found." };
    }

    if (payload.githubUrl !== undefined) {
      project.githubUrl = String(payload.githubUrl || "").trim();
    }

    if (payload.jiraProjectKey !== undefined) {
      project.jiraProjectKey = String(payload.jiraProjectKey || "").trim().toUpperCase();
    }

    if (payload.jiraBoardLink !== undefined) {
      project.jiraBoardLink = String(payload.jiraBoardLink || "").trim();
    }

    if (payload.commsLink !== undefined) {
      project.commsLink = String(payload.commsLink || "").trim();
    }

    ensureIntegrationModel(project);
    addAuditEventInternal(db, projectId, "INTEGRATION_UPDATED", actorId || null, {
      githubStatus: project.githubIntegration.status,
      jiraStatus: project.jiraIntegration.status,
      commsStatus: project.commsIntegration.status
    });

    saveDB(db);
    return { ok: true, project: clone(project) };
  }

  function addFile(projectId, fileMeta) {
    var db = init();
    var rec = {
      id: "f_" + Date.now(),
      projectId: projectId,
      name: fileMeta.name,
      size: fileMeta.size,
      type: fileMeta.type,
      uploadedAt: nowIso(),
      uploaderId: fileMeta.uploaderId
    };
    db.files.push(rec);
    addAuditEventInternal(db, projectId, "FILE_ADDED", fileMeta.uploaderId || null, {
      fileId: rec.id,
      fileName: rec.name
    });
    saveDB(db);
    return clone(rec);
  }

  function getProjectSummary(projectId) {
    var db = init();
    var project = db.projects.find(function (p) { return p.id === projectId; });
    if (!project) {
      return null;
    }

    var actions = db.actionItems.filter(function (a) { return a.projectId === projectId; });
    var meetings = db.meetings.filter(function (m) { return m.projectId === projectId; });
    var open = actions.filter(function (a) { return a.status !== "Done"; }).length;
    var overdue = actions.filter(isOverdueAction).length;

    return {
      openActionItems: open,
      overdueCount: overdue,
      meetingCount: meetings.length
    };
  }

  function statsForDashboard(projects) {
    var db = init();
    var projectIds = projects.map(function (p) { return p.id; });
    var total = projects.length;
    var onTrack = projects.filter(function (p) { return p.lifecycleStatus === "ACTIVE"; }).length;
    var atRisk = projects.filter(function (p) { return p.lifecycleStatus === "AT_RISK"; }).length;
    var behind = projects.filter(function (p) { return p.lifecycleStatus === "BEHIND"; }).length;
    var overdue = db.actionItems.filter(function (a) {
      return projectIds.indexOf(a.projectId) > -1 && isOverdueAction(a);
    }).length;

    var thisWeekCutoff = new Date();
    thisWeekCutoff.setDate(thisWeekCutoff.getDate() - 7);

    var activeStudents = new Set(
      db.actionItems.filter(function (a) {
        return projectIds.indexOf(a.projectId) > -1 && new Date(a.lastUpdatedAt || a.createdAt) >= thisWeekCutoff;
      }).map(function (a) { return a.assigneeId || a.ownerId; })
    ).size;

    return {
      total: total,
      onTrack: onTrack,
      atRisk: atRisk,
      behind: behind,
      overdue: overdue,
      activeStudents: activeStudents
    };
  }

  function simulate(data, delay) {
    var wait = typeof delay === "number" ? delay : (350 + Math.floor(Math.random() * 350));
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(clone(data));
      }, wait);
    });
  }

  function listStudents() {
    return clone(init().users.filter(function (u) { return u.role === "STUDENT"; }));
  }

  function getMeetingById(meetingId) {
    var db = init();
    return clone(db.meetings.find(function (m) { return m.id === meetingId; }) || null);
  }

  function listMyActionItems(userId) {
    var db = init();
    return clone(db.actionItems.filter(function (a) { return a.assigneeId === userId || a.ownerId === userId; }))
      .map(function (a) {
        a.isOverdue = isOverdueAction(a);
        return a;
      })
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });
  }

  function listProjectAuditEvents(projectId) {
    var project = getProjectById(projectId);
    if (!project) {
      return [];
    }
    return safeArray(project.auditEvents).slice().sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }

  window.Store = {
    init: init,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    touchSession: touchSession,
    login: login,
    emailExists: emailExists,
    registerUser: registerUser,
    getCurrentUser: getCurrentUser,
    getUserById: getUserById,
    getProjectsForUser: getProjectsForUser,
    getProjectById: getProjectById,
    createProject: createProject,
    upsertProject: upsertProject,
    canTransitionProjectStatus: canTransitionProjectStatus,
    applyProjectStatusTransition: applyProjectStatusTransition,
    updateProjectIntegrations: updateProjectIntegrations,
    addAuditEvent: addAuditEvent,
    listMeetings: listMeetings,
    listActionItems: listActionItems,
    listFiles: listFiles,
    createMeeting: createMeeting,
    submitMeeting: submitMeeting,
    approveMeeting: approveMeeting,
    addMeeting: addMeeting,
    canEditActionItem: canEditActionItem,
    validateActionItemTransition: validateActionItemTransition,
    updateActionItem: updateActionItem,
    updateActionItemStatus: updateActionItemStatus,
    linkActionItemJira: linkActionItemJira,
    createMockJiraForAction: createMockJiraForAction,
    addFile: addFile,
    getProjectSummary: getProjectSummary,
    statsForDashboard: statsForDashboard,
    simulate: simulate,
    listStudents: listStudents,
    getMeetingById: getMeetingById,
    listMyActionItems: listMyActionItems,
    listProjectAuditEvents: listProjectAuditEvents,
    isOverdueAction: isOverdueAction,
    lifecycleToLegacyStatus: lifecycleToLegacyStatus,
    getFinalizeItems: getFinalizeItems,
    addFinalizeItem: addFinalizeItem,
    updateFinalizeItem: updateFinalizeItem,
    deleteFinalizeItem: deleteFinalizeItem,
    exportFinalizeItems: exportFinalizeItems,
    getFinalizeStats: getFinalizeStats,
    resetFinalizeItems: resetFinalizeItems,
    canManageFinalize: canManageFinalize
  };
})();
