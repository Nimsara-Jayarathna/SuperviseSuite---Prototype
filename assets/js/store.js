(function () {
  var DB_KEY = "supervise_prototype_db_v1";
  var SESSION_KEY = "supervise_prototype_session";

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
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
      saveDB(db);
    } else {
      var dirty = false;
      db.users.forEach(function (u) {
        if (!u.name && u.fullName) {
          u.name = u.fullName;
          dirty = true;
        }
        if (!u.fullName && u.name) {
          u.fullName = u.name;
          dirty = true;
        }
        if (!u.createdAt) {
          u.createdAt = new Date().toISOString();
          dirty = true;
        }
      });
      if (dirty) {
        saveDB(db);
      }
    }
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
    var now = new Date().toISOString();
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
    var now = new Date().toISOString();
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
      createdAt: new Date().toISOString()
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
    session.lastActiveAt = new Date().toISOString();
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

  function upsertProject(project) {
    var db = init();
    var idx = db.projects.findIndex(function (p) { return p.id === project.id; });
    if (idx === -1) {
      db.projects.push(project);
    } else {
      db.projects[idx] = project;
    }
    saveDB(db);
    return clone(project);
  }

  function createProject(payload, userId) {
    var p = {
      id: "p_" + Date.now(),
      title: payload.title,
      batch: payload.batch,
      semester: payload.semester,
      milestoneDate: payload.milestoneDate,
      studentIds: payload.studentIds,
      status: payload.status || "On track",
      githubUrl: payload.githubUrl || "",
      jiraProjectKey: payload.jiraProjectKey || "",
      jiraBoardLink: payload.jiraBoardLink || "",
      commsLink: payload.commsLink,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      analytics: {
        commitsWeek: 0,
        openIssues: 0,
        jiraTodo: 0,
        jiraInProgress: 0,
        jiraDone: 0,
        lastActivityAt: new Date().toISOString(),
        activityWeeks: [0, 0, 0, 0, 0, 0],
        contributions: payload.studentIds.map(function (sid) {
          return { userId: sid, commits: 0, prs: 0 };
        })
      }
    };
    return upsertProject(p);
  }

  function listMeetings(projectId) {
    var db = init();
    return clone(db.meetings.filter(function (m) { return m.projectId === projectId; }))
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

  function listActionItems(projectId) {
    var db = init();
    return clone(db.actionItems.filter(function (a) { return a.projectId === projectId; }))
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });
  }

  function listFiles(projectId) {
    var db = init();
    return clone(db.files.filter(function (f) { return f.projectId === projectId; }))
      .sort(function (a, b) { return new Date(b.uploadedAt) - new Date(a.uploadedAt); });
  }

  function addMeeting(projectId, meetingData, actionData) {
    var db = init();
    var meetingId = "m_" + Date.now();
    var actionIds = [];
    actionData.forEach(function (item, index) {
      var aid = "a_" + Date.now() + "_" + index;
      actionIds.push(aid);
      db.actionItems.push({
        id: aid,
        projectId: projectId,
        meetingId: meetingId,
        description: item.description,
        ownerId: item.ownerId,
        dueDate: item.dueDate,
        priority: item.priority,
        status: "Todo",
        jira: item.jira || null,
        createdAt: new Date().toISOString()
      });
    });

    db.meetings.push({
      id: meetingId,
      projectId: projectId,
      title: meetingData.title,
      date: meetingData.date,
      summary: meetingData.summary,
      decisions: meetingData.decisions,
      actionItemIds: actionIds,
      createdAt: new Date().toISOString()
    });

    var project = db.projects.find(function (p) { return p.id === projectId; });
    if (project) {
      project.analytics.lastActivityAt = new Date().toISOString();
      project.analytics.activityWeeks[5] += actionIds.length;
      project.analytics.commitsWeek += 1;
    }

    saveDB(db);
    return { meetingId: meetingId, actionIds: actionIds };
  }

  function updateActionItemStatus(actionId, status) {
    var db = init();
    var item = db.actionItems.find(function (a) { return a.id === actionId; });
    if (!item) {
      return null;
    }
    item.status = status;
    saveDB(db);
    return clone(item);
  }

  function linkActionItemJira(actionId, jiraData) {
    var db = init();
    var item = db.actionItems.find(function (a) { return a.id === actionId; });
    if (!item) {
      return null;
    }
    item.jira = jiraData;
    saveDB(db);
    return clone(item);
  }

  function createMockJiraForAction(actionId, projectId) {
    var db = init();
    var project = db.projects.find(function (p) { return p.id === projectId; });
    var action = db.actionItems.find(function (a) { return a.id === actionId; });
    if (!project || !action || !project.jiraProjectKey) {
      return null;
    }
    var num = Math.floor(100 + Math.random() * 900);
    var key = project.jiraProjectKey + "-" + num;
    action.jira = {
      key: key,
      url: "https://jira.example.com/browse/" + key
    };
    project.analytics.openIssues += 1;
    saveDB(db);
    return clone(action);
  }

  function addFile(projectId, fileMeta) {
    var db = init();
    var rec = {
      id: "f_" + Date.now(),
      projectId: projectId,
      name: fileMeta.name,
      size: fileMeta.size,
      type: fileMeta.type,
      uploadedAt: new Date().toISOString(),
      uploaderId: fileMeta.uploaderId
    };
    db.files.push(rec);
    saveDB(db);
    return clone(rec);
  }

  function statsForDashboard(projects) {
    var db = init();
    var total = projects.length;
    var onTrack = projects.filter(function (p) { return p.status === "On track"; }).length;
    var atRisk = projects.filter(function (p) { return p.status === "At risk"; }).length;
    var behind = projects.filter(function (p) { return p.status === "Behind"; }).length;
    var overdue = db.actionItems.filter(function (a) {
      return new Date(a.dueDate) < new Date() && a.status !== "Done";
    }).length;
    var thisWeekCutoff = new Date();
    thisWeekCutoff.setDate(thisWeekCutoff.getDate() - 7);
    var activeStudents = new Set(
      db.actionItems.filter(function (a) {
        return new Date(a.createdAt) >= thisWeekCutoff;
      }).map(function (a) { return a.ownerId; })
    ).size;

    return { total: total, onTrack: onTrack, atRisk: atRisk, behind: behind, overdue: overdue, activeStudents: activeStudents };
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
    return clone(db.actionItems.filter(function (a) { return a.ownerId === userId; }))
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });
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
    listMeetings: listMeetings,
    listActionItems: listActionItems,
    listFiles: listFiles,
    addMeeting: addMeeting,
    updateActionItemStatus: updateActionItemStatus,
    linkActionItemJira: linkActionItemJira,
    createMockJiraForAction: createMockJiraForAction,
    addFile: addFile,
    statsForDashboard: statsForDashboard,
    simulate: simulate,
    listStudents: listStudents,
    getMeetingById: getMeetingById,
    listMyActionItems: listMyActionItems
  };
})();
