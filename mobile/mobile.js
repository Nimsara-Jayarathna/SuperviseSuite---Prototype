(function () {
  var state = {
    route: null,
    user: null,
    projectSearch: "",
    projectFilters: {
      status: "",
      semester: "",
      batch: ""
    },
    projectTab: "overview",
    activityTab: "github"
  };

  var projectTabs = ["overview", "activity", "meetings", "action-items", "files"];
  var appRoot = document.getElementById("mobile-app");

  function safe(text) {
    return window.UI && UI.escapeHtml ? UI.escapeHtml(text) : String(text || "");
  }

  function byId(items, id) {
    return (items || []).find(function (item) { return item.id === id; }) || null;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function normalizePath(path) {
    var clean = String(path || "/").trim();
    if (!clean) {
      return "/";
    }
    if (!clean.startsWith("/")) {
      clean = "/" + clean;
    }
    return clean;
  }

  function parseRoute() {
    var raw = location.hash && location.hash.indexOf("#/") === 0 ? location.hash.slice(1) : "/login";
    var parts = raw.split("?");
    var path = normalizePath(parts[0]);
    var query = {};

    if (parts[1]) {
      parts[1].split("&").forEach(function (pair) {
        var kv = pair.split("=");
        if (kv[0]) {
          query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
        }
      });
    }

    var match = path.match(/^\/projects\/([^/]+)$/);
    if (match) {
      return {
        raw: raw,
        path: "/projects/:id",
        params: { id: match[1] },
        query: query
      };
    }

    return {
      raw: raw,
      path: path,
      params: {},
      query: query
    };
  }

  function go(path) {
    var target = normalizePath(path || "/login");
    if (location.hash !== "#" + target) {
      location.hash = "#" + target;
    } else {
      renderCurrentRoute();
    }
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleDateString() : "-";
  }

  function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : "-";
  }

  function formatBytes(value) {
    if (window.UI && UI.formatBytes) {
      return UI.formatBytes(value);
    }
    return value + " B";
  }

  function toast(message) {
    if (window.UI && UI.toast) {
      UI.toast(message);
    }
  }

  function lifecycleTone(status) {
    if (status === "ACTIVE" || status === "COMPLETED" || status === "ARCHIVED") {
      return "on-track";
    }
    if (status === "AT_RISK" || status === "DRAFT") {
      return "at-risk";
    }
    return "behind";
  }

  function lifecycleBadge(status) {
    var text = String(status || "DRAFT").replace(/_/g, " ");
    return '<span class="badge ' + lifecycleTone(status) + '">' + safe(text) + "</span>";
  }

  function meetingBadge(status) {
    if (status === "APPROVED") {
      return '<span class="badge on-track">APPROVED</span>';
    }
    if (status === "SUBMITTED") {
      return '<span class="badge at-risk">SUBMITTED</span>';
    }
    return '<span class="badge info">DRAFT</span>';
  }

  function roleHome(role) {
    return role === "SUPERVISOR" ? "/dashboard" : "/projects";
  }

  function getCurrentUser() {
    return window.Store ? Store.getCurrentUser() : null;
  }

  function isSupervisor() {
    return !!(state.user && state.user.role === "SUPERVISOR");
  }

  function visibleProjects() {
    return state.user ? Store.getProjectsForUser(state.user) : [];
  }

  function students() {
    return Store.listStudents();
  }

  function guardRoute(route) {
    var user = getCurrentUser();
    state.user = user;

    if (!user && route.path !== "/login") {
      go("/login");
      return false;
    }

    if (user && route.path === "/login") {
      go(roleHome(user.role));
      return false;
    }

    if (!user) {
      return true;
    }

    Store.touchSession();

    if (!isSupervisor() && (route.path === "/dashboard" || route.path === "/activity")) {
      go("/projects");
      return false;
    }

    if (route.path === "/projects/:id") {
      var project = Store.getProjectById(route.params.id);
      if (!project) {
        go("/projects");
        return false;
      }
      if (!isSupervisor() && project.studentIds.indexOf(user.id) === -1) {
        go("/projects");
        return false;
      }
    }

    return true;
  }

  function shellTitle(route) {
    if (!state.user) {
      return "Login";
    }
    if (route.path === "/dashboard") {
      return "Dashboard";
    }
    if (route.path === "/projects") {
      return "Projects";
    }
    if (route.path === "/projects/:id") {
      var project = Store.getProjectById(route.params.id);
      return project ? project.title : "Project";
    }
    if (route.path === "/activity") {
      return "Activity";
    }
    if (route.path === "/settings") {
      return "Settings";
    }
    return "SuperviseSuite";
  }

  function renderShell(contentHtml, options) {
    options = options || {};
    var title = options.title || shellTitle(state.route);
    var showBack = !!options.showBack;
    var actions = options.actionsHtml || "";
    var navItems = isSupervisor()
      ? [
        { path: "/dashboard", label: "Dashboard", icon: "◼" },
        { path: "/projects", label: "Projects", icon: "▣" },
        { path: "/activity", label: "Activity", icon: "◌" },
        { path: "/settings", label: "Settings", icon: "◎" }
      ]
      : [
        { path: "/projects", label: "Projects", icon: "▣" },
        { path: "/settings", label: "Settings", icon: "◎" }
      ];

    appRoot.innerHTML =
      '<div class="mobile-shell">' +
      '<header class="topbar">' +
      '<div class="topbar-leading">' +
      (showBack ? '<button class="btn ghost small" id="topbar-back" type="button">Back</button>' : '<span class="eyebrow">SuperviseSuite</span>') +
      '</div>' +
      '<div class="topbar-title"><span class="eyebrow">' + safe(state.user.role) + '</span><h1>' + safe(title) + '</h1></div>' +
      '<div class="topbar-actions">' + actions + '</div>' +
      '</header>' +
      '<main class="app-main">' + contentHtml + "</main>" +
      '<nav class="nav-bottom ' + (!isSupervisor() ? "compact" : "") + '">' +
      navItems.map(function (item) {
        var active = state.route.path === item.path || (item.path === "/projects" && state.route.path === "/projects/:id");
        return '<a class="nav-link ' + (active ? "active" : "") + '" href="#' + item.path + '"><span class="nav-icon">' + safe(item.icon) + '</span><span>' + safe(item.label) + "</span></a>";
      }).join("") +
      "</nav>" +
      "</div>";

    var back = el("topbar-back");
    if (back) {
      back.addEventListener("click", function () {
        if (state.route.path === "/projects/:id") {
          go("/projects");
          return;
        }
        go(roleHome(state.user.role));
      });
    }
  }

  function renderLogin() {
    appRoot.innerHTML =
      '<div class="login-shell">' +
      '<main class="card login-card">' +
      '<span class="eyebrow">SuperviseSuite</span>' +
      '<h1>Mobile Access</h1>' +
      '<p class="section-copy">Uses the same seeded accounts and session storage as the desktop prototype.</p>' +
      '<div class="stack" style="margin-top:16px">' +
      '<div class="inline-actions">' +
      '<button class="btn small" type="button" data-demo="supervisor@demo.com">Supervisor Demo</button>' +
      '<button class="btn small" type="button" data-demo="student1@demo.com">Student 1</button>' +
      '<button class="btn small" type="button" data-demo="student2@demo.com">Student 2</button>' +
      '</div>' +
      '<div class="field"><label for="login-email">Email</label><input id="login-email" type="email" value="supervisor@demo.com" autocomplete="email" /></div>' +
      '<div class="field"><label for="login-password">Password</label><input id="login-password" type="password" value="demo123" autocomplete="current-password" /></div>' +
      '<div class="field-error" id="login-error"></div>' +
      '<button class="btn primary block" id="login-submit" type="button">Login</button>' +
      '<p class="meta">All demo accounts use <strong>demo123</strong>.</p>' +
      '</div>' +
      '</main>' +
      '</div>';

    document.querySelectorAll("[data-demo]").forEach(function (button) {
      button.addEventListener("click", function () {
        el("login-email").value = button.getAttribute("data-demo");
        el("login-password").value = "demo123";
      });
    });

    el("login-submit").addEventListener("click", function () {
      var email = el("login-email").value.trim();
      var password = el("login-password").value;
      var session = Store.login(email, password);
      if (!session) {
        el("login-error").textContent = "Invalid credentials.";
        toast("Login failed");
        return;
      }
      state.user = Store.getCurrentUser();
      toast("Login successful");
      go(roleHome(session.role));
    });
  }

  function dashboardStatCard(label, value) {
    return '<div class="stat-card"><div class="stat-label">' + safe(label) + '</div><div class="stat-value">' + value + "</div></div>";
  }

  function milestoneText(project) {
    return project.milestoneDate ? formatDate(project.milestoneDate) : "No milestone";
  }

  function dashboardProjectCard(project) {
    var summary = Store.getProjectSummary(project.id) || { openActionItems: 0, overdueCount: 0, meetingCount: 0 };
    return '<article class="project-card">' +
      '<div class="project-card-head">' +
      '<div><h3>' + safe(project.title) + '</h3><p class="meta">Milestone: ' + safe(milestoneText(project)) + '</p></div>' +
      lifecycleBadge(project.lifecycleStatus) +
      '</div>' +
      '<div class="meta-grid">' +
      '<div class="meta-item"><span class="meta-label">Open Actions</span><span>' + summary.openActionItems + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Overdue</span><span>' + summary.overdueCount + '</span></div>' +
      '</div>' +
      '<button class="btn primary block" type="button" data-open-project="' + safe(project.id) + '">Open Project</button>' +
      '</article>';
  }

  function renderDashboard() {
    var projects = visibleProjects();
    var stats = Store.statsForDashboard(projects);
    var visible = projects.slice(0, 8);
    var activitySummary = [
      projects.filter(function (p) { return p.githubIntegration.status === "CONNECTED"; }).length + " GitHub connected",
      projects.filter(function (p) { return p.jiraIntegration.status === "CONNECTED"; }).length + " Jira connected",
      projects.reduce(function (sum, p) {
        return sum + (Store.getProjectSummary(p.id) || { meetingCount: 0 }).meetingCount;
      }, 0) + " logged meetings"
    ];

    renderShell(
      '<section class="screen">' +
      '<div class="stats-grid">' +
      dashboardStatCard("Active", stats.onTrack) +
      dashboardStatCard("At Risk", stats.atRisk) +
      dashboardStatCard("Overdue", stats.overdue) +
      dashboardStatCard("Completed", projects.filter(function (p) { return p.lifecycleStatus === "COMPLETED"; }).length) +
      '</div>' +
      '<section class="card card-muted"><div class="section-head"><div><h2>Activity Summary</h2><p class="section-copy">Mobile view replaces desktop charts with quick counts.</p></div></div><div class="stack">' +
      activitySummary.map(function (item) {
        return '<div class="list-card">' + safe(item) + "</div>";
      }).join("") +
      '</div></section>' +
      '<section class="card"><div class="section-head"><div><h2>Priority Projects</h2><p class="section-copy">Quick access to the active portfolio.</p></div><button class="btn text" type="button" id="see-all-projects">See all</button></div><div class="stack">' +
      (visible.length ? visible.map(dashboardProjectCard).join("") : '<div class="empty">No projects available.</div>') +
      '</div></section>' +
      '</section>'
    );

    var seeAll = el("see-all-projects");
    if (seeAll) {
      seeAll.addEventListener("click", function () {
        go("/projects");
      });
    }
    bindProjectOpenButtons();
  }

  function openFilterModal(filterKey, label, options) {
    var current = state.projectFilters[filterKey] || "";
    var body = '<div class="stack">';
    body += '<div class="field"><label for="filter-value">' + safe(label) + '</label><select id="filter-value">';
    body += '<option value="">All</option>';
    options.forEach(function (option) {
      body += '<option value="' + safe(option) + '" ' + (current === option ? "selected" : "") + '>' + safe(option) + "</option>";
    });
    body += '</select></div></div>';

    UI.openModal("Filter " + label, body, '<button class="btn ghost small" id="filter-clear">Clear</button><button class="btn primary small" id="filter-apply">Apply</button>');
    el("filter-clear").addEventListener("click", function () {
      state.projectFilters[filterKey] = "";
      UI.closeModal();
      renderProjects();
    });
    el("filter-apply").addEventListener("click", function () {
      state.projectFilters[filterKey] = el("filter-value").value;
      UI.closeModal();
      renderProjects();
    });
  }

  function filterProjects(projects) {
    return projects.filter(function (project) {
      var term = state.projectSearch.toLowerCase();
      var userNames = project.studentIds.map(function (studentId) {
        var user = byId(students(), studentId);
        return user ? user.name.toLowerCase() : "";
      }).join(" ");
      var qMatch = !term || project.title.toLowerCase().indexOf(term) > -1 || userNames.indexOf(term) > -1;
      var statusMatch = !state.projectFilters.status || project.lifecycleStatus === state.projectFilters.status;
      var semesterMatch = !state.projectFilters.semester || project.semester === state.projectFilters.semester;
      var batchMatch = !state.projectFilters.batch || project.batch === state.projectFilters.batch;
      return qMatch && statusMatch && semesterMatch && batchMatch;
    });
  }

  function projectListCard(project) {
    var summary = Store.getProjectSummary(project.id) || { openActionItems: 0, overdueCount: 0, meetingCount: 0 };
    var memberNames = project.studentIds.map(function (studentId) {
      var student = byId(students(), studentId);
      return student ? student.name : studentId;
    }).join(", ");

    return '<article class="project-card" data-open-project="' + safe(project.id) + '" role="button" tabindex="0">' +
      '<div class="project-card-head"><div><h3>' + safe(project.title) + '</h3><p class="meta">' + safe(memberNames || "No members") + '</p></div>' + lifecycleBadge(project.lifecycleStatus) + '</div>' +
      '<div class="meta-grid">' +
      '<div class="meta-item"><span class="meta-label">Batch</span><span>' + safe(project.batch || "-") + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Semester</span><span>' + safe(project.semester || "-") + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Milestone</span><span>' + safe(milestoneText(project)) + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Open / Overdue</span><span>' + summary.openActionItems + " / " + summary.overdueCount + '</span></div>' +
      '</div>' +
      '</article>';
  }

  function renderProjects() {
    var projects = filterProjects(visibleProjects());
    var allProjects = visibleProjects();
    var statuses = ["DRAFT", "ACTIVE", "AT_RISK", "BEHIND", "COMPLETED", "ARCHIVED", "CANCELLED"];
    var semesters = allProjects.map(function (p) { return p.semester; }).filter(Boolean).filter(function (value, index, arr) { return arr.indexOf(value) === index; });
    var batches = allProjects.map(function (p) { return p.batch; }).filter(Boolean).filter(function (value, index, arr) { return arr.indexOf(value) === index; });

    renderShell(
      '<section class="screen">' +
      '<section class="card search-shell">' +
      '<input id="project-search" class="input" type="search" placeholder="Search by project or student" value="' + safe(state.projectSearch) + '" />' +
      '<div class="chip-row">' +
      '<button class="btn chip ' + (state.projectFilters.status ? "is-active" : "") + '" id="chip-status" type="button">Status' + (state.projectFilters.status ? ": " + safe(state.projectFilters.status) : "") + '</button>' +
      '<button class="btn chip ' + (state.projectFilters.semester ? "is-active" : "") + '" id="chip-semester" type="button">Semester' + (state.projectFilters.semester ? ": " + safe(state.projectFilters.semester) : "") + '</button>' +
      '<button class="btn chip ' + (state.projectFilters.batch ? "is-active" : "") + '" id="chip-batch" type="button">Batch' + (state.projectFilters.batch ? ": " + safe(state.projectFilters.batch) : "") + '</button>' +
      '</div>' +
      '</section>' +
      '<section class="stack">' +
      (projects.length ? projects.map(projectListCard).join("") : '<div class="empty">No projects match the current filters.</div>') +
      '</section>' +
      '</section>'
    );

    el("project-search").addEventListener("input", function () {
      state.projectSearch = el("project-search").value.trim();
      renderProjects();
    });
    el("chip-status").addEventListener("click", function () {
      openFilterModal("status", "Status", statuses);
    });
    el("chip-semester").addEventListener("click", function () {
      openFilterModal("semester", "Semester", semesters);
    });
    el("chip-batch").addEventListener("click", function () {
      openFilterModal("batch", "Batch", batches);
    });

    bindProjectOpenButtons();
  }

  function bindProjectOpenButtons() {
    document.querySelectorAll("[data-open-project]").forEach(function (button) {
      var open = function () {
        go("/projects/" + button.getAttribute("data-open-project"));
      };
      button.addEventListener("click", open);
      button.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function openMeetingDetail(meeting, projectStudents) {
    var relatedActions = Store.listActionItems(meeting.projectId).filter(function (item) {
      return item.meetingId === meeting.id;
    });
    var body = '<div class="stack">' +
      '<div>' + meetingBadge(meeting.status) + '</div>' +
      '<div class="meta">Date: ' + safe(formatDate(meeting.date)) + '</div>' +
      '<div><strong>Summary</strong><p class="section-copy">' + safe(meeting.summary) + '</p></div>' +
      '<div><strong>Decisions</strong><p class="section-copy">' + safe(meeting.decisions || "No decisions recorded.") + '</p></div>' +
      '<div><strong>Action Items</strong>' +
      (relatedActions.length
        ? relatedActions.map(function (item) {
          var assignee = byId(projectStudents, item.assigneeId || item.ownerId);
          return '<div class="list-card" style="margin-top:8px"><h4>' + safe(item.description) + '</h4><p class="meta">' + safe(assignee ? assignee.name : "Unknown") + " · " + safe(item.priority) + '</p></div>';
        }).join("")
        : '<p class="section-copy">No linked action items.</p>') +
      '</div>' +
      '</div>';
    UI.openModal(meeting.title, body, "");
  }

  function openIntegrationsModal(project) {
    var body = '<div class="stack">' +
      '<div class="field"><label for="m-gh">GitHub URL</label><input id="m-gh" value="' + safe(project.githubUrl || "") + '" /></div>' +
      '<div class="field"><label for="m-jira">Jira Project Key</label><input id="m-jira" value="' + safe(project.jiraProjectKey || "") + '" /></div>' +
      '<div class="field"><label for="m-jira-board">Jira Board Link</label><input id="m-jira-board" value="' + safe(project.jiraBoardLink || "") + '" /></div>' +
      '<div class="field"><label for="m-comms">Communication Link</label><input id="m-comms" value="' + safe(project.commsLink || "") + '" /></div>' +
      '</div>';
    UI.openModal("Edit Integrations", body, '<button class="btn primary small" id="save-integrations">Save</button>');
    el("save-integrations").addEventListener("click", function () {
      var result = Store.updateProjectIntegrations(project.id, {
        githubUrl: el("m-gh").value.trim(),
        jiraProjectKey: el("m-jira").value.trim().toUpperCase(),
        jiraBoardLink: el("m-jira-board").value.trim(),
        commsLink: el("m-comms").value.trim()
      }, state.user.id);
      if (!result.ok) {
        toast(result.message || "Unable to save integrations.");
        return;
      }
      UI.closeModal();
      toast("Integrations updated");
      renderProjectDetail(project.id);
    });
  }

  function renderProjectDetail(projectId) {
    var project = Store.getProjectById(projectId);
    if (!project) {
      go("/projects");
      return;
    }

    var projectStudents = students().filter(function (student) {
      return project.studentIds.indexOf(student.id) > -1;
    });
    var meetings = Store.listMeetings(project.id);
    var actions = Store.listActionItems(project.id);
    var files = Store.listFiles(project.id);
    var summary = Store.getProjectSummary(project.id) || { openActionItems: 0, overdueCount: 0, meetingCount: 0 };
    var tab = projectTabs.indexOf(state.route.query.tab) > -1 ? state.route.query.tab : (state.projectTab || "overview");
    state.projectTab = tab;

    var tabContent = "";
    if (tab === "overview") {
      tabContent =
        '<div class="project-tab-content">' +
        '<div class="card card-muted">' +
        '<div class="section-head"><div><h3>Project Snapshot</h3><p class="section-copy">' + safe(project.batch || "-") + " · " + safe(project.semester || "-") + '</p></div></div>' +
        '<div class="meta-grid">' +
        '<div class="meta-item"><span class="meta-label">Milestone</span><span>' + safe(milestoneText(project)) + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">Open / Overdue</span><span>' + summary.openActionItems + " / " + summary.overdueCount + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">Meetings</span><span>' + summary.meetingCount + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">Last Activity</span><span>' + safe(formatDateTime(project.analytics.lastActivityAt)) + '</span></div>' +
        '</div>' +
        '</div>' +
        '<div class="card"><div class="section-head"><div><h3>Members</h3><p class="section-copy">Assigned students for this project.</p></div></div><div class="inline-actions">' +
        projectStudents.map(function (student) {
          return '<span class="badge info">' + safe(student.name) + '</span>';
        }).join("") +
        '</div></div>' +
        '<div class="card"><div class="section-head"><div><h3>Integrations</h3></div>' + (isSupervisor() ? '<button class="btn small" id="edit-integrations" type="button">Edit</button>' : "") + '</div>' +
        '<div class="stack">' +
        '<div class="list-card"><strong>GitHub</strong><p class="meta">' + safe(project.githubIntegration.status) + (project.githubUrl ? " · " + safe(project.githubUrl) : "") + '</p></div>' +
        '<div class="list-card"><strong>Jira</strong><p class="meta">' + safe(project.jiraIntegration.status) + (project.jiraProjectKey ? " · " + safe(project.jiraProjectKey) : "") + '</p></div>' +
        '<div class="list-card"><strong>Communication</strong><p class="meta">' + safe(project.commsIntegration.status) + (project.commsLink ? " · " + safe(project.commsLink) : "") + '</p></div>' +
        '</div></div>' +
        (isSupervisor()
          ? '<div class="card"><div class="section-head"><div><h3>Lifecycle Control</h3><p class="section-copy">Students cannot change lifecycle state.</p></div></div><div class="stack"><select id="project-status-next">' +
            ["DRAFT", "ACTIVE", "AT_RISK", "BEHIND", "COMPLETED", "ARCHIVED", "CANCELLED"].map(function (status) {
              return '<option ' + (project.lifecycleStatus === status ? "selected" : "") + ">" + status + "</option>";
            }).join("") +
            '</select><button class="btn primary block" type="button" id="apply-status">Apply Status</button></div></div>'
          : "") +
        '</div>';
    }

    if (tab === "activity") {
      var contributions = (project.analytics.contributions || []).map(function (item) {
        var student = byId(projectStudents, item.userId);
        return '<div class="list-card"><h4>' + safe(student ? student.name : item.userId) + '</h4><p class="meta">' + item.commits + " commits · " + item.prs + ' PRs</p></div>';
      }).join("");
      tabContent =
        '<div class="project-tab-content">' +
        '<div class="card"><div class="section-head"><div><h3>GitHub</h3><p class="section-copy">Aggregate activity available in the current store.</p></div></div>' +
        '<div class="stack">' +
        '<div class="list-card"><strong>Commits This Week</strong><p class="meta">' + project.analytics.commitsWeek + '</p></div>' +
        '<div class="list-card"><strong>Last Synced Activity</strong><p class="meta">' + safe(formatDateTime(project.analytics.lastActivityAt)) + '</p></div>' +
        (contributions || '<div class="empty">No contribution snapshots recorded.</div>') +
        '</div></div>' +
        '<div class="card"><div class="section-head"><div><h3>Jira</h3></div></div><div class="stack">' +
        '<div class="list-card"><strong>To Do</strong><p class="meta">' + project.analytics.jiraTodo + '</p></div>' +
        '<div class="list-card"><strong>In Progress</strong><p class="meta">' + project.analytics.jiraInProgress + '</p></div>' +
        '<div class="list-card"><strong>Done</strong><p class="meta">' + project.analytics.jiraDone + '</p></div>' +
        '</div></div>' +
        '</div>';
    }

    if (tab === "meetings") {
      tabContent =
        '<div class="project-tab-content">' +
        (meetings.length ? meetings.map(function (meeting) {
          return '<article class="list-card"><div class="list-card-head"><div><h4>' + safe(meeting.title) + '</h4><p class="meta">' + safe(formatDate(meeting.date)) + '</p></div>' + meetingBadge(meeting.status) + '</div><p class="section-copy">' + safe(meeting.summary) + '</p><button class="btn block" type="button" data-open-meeting="' + safe(meeting.id) + '">View Details</button></article>';
        }).join("") : '<div class="empty">No meetings recorded.</div>') +
        '</div>';
    }

    if (tab === "action-items") {
      tabContent =
        '<div class="project-tab-content">' +
        (actions.length ? actions.map(function (item) {
          var assignee = byId(projectStudents, item.assigneeId || item.ownerId);
          var tone = item.status === "Done" ? "on-track" : (item.isOverdue ? "behind" : "info");
          return '<article class="list-card"><div class="list-card-head"><div><h4>' + safe(item.description) + '</h4><p class="meta">' + safe(assignee ? assignee.name : "Unassigned") + '</p></div><span class="badge ' + tone + '">' + safe(item.status) + '</span></div><div class="meta-grid"><div class="meta-item"><span class="meta-label">Due</span><span>' + safe(formatDate(item.dueDate)) + '</span></div><div class="meta-item"><span class="meta-label">Priority</span><span>' + safe(item.priority) + '</span></div></div>' + (item.jira ? '<p class="meta">Jira: ' + safe(item.jira.key) + '</p>' : "") + '</article>';
        }).join("") : '<div class="empty">No action items recorded.</div>') +
        '</div>';
    }

    if (tab === "files") {
      tabContent =
        '<div class="project-tab-content">' +
        (isSupervisor()
          ? '<div class="card"><div class="section-head"><div><h3>Upload Metadata</h3><p class="section-copy">Matches desktop behavior: metadata only.</p></div></div><input id="file-upload" type="file" /></div>'
          : "") +
        (files.length ? files.map(function (file) {
          var uploader = Store.getUserById(file.uploaderId);
          return '<article class="list-card"><h4>' + safe(file.name) + '</h4><div class="meta-grid"><div class="meta-item"><span class="meta-label">Uploader</span><span>' + safe(uploader ? uploader.name : file.uploaderId) + '</span></div><div class="meta-item"><span class="meta-label">Size</span><span>' + safe(formatBytes(file.size)) + '</span></div><div class="meta-item"><span class="meta-label">Type</span><span>' + safe(file.type || "-") + '</span></div><div class="meta-item"><span class="meta-label">Uploaded</span><span>' + safe(formatDateTime(file.uploadedAt)) + '</span></div></div><button class="btn block" type="button" data-download-file="' + safe(file.id) + '">Download</button></article>';
        }).join("") : '<div class="empty">No files uploaded.</div>') +
        '</div>';
    }

    renderShell(
      '<section class="screen">' +
      '<section class="card">' +
      '<div class="project-card-head"><div><h2 style="margin:0">' + safe(project.title) + '</h2><p class="section-copy">Batch ' + safe(project.batch || "-") + " · " + safe(project.semester || "-") + '</p></div>' + lifecycleBadge(project.lifecycleStatus) + '</div>' +
      '</section>' +
      '<section class="tabs">' +
      projectTabs.map(function (name) {
        var label = name === "action-items" ? "Action Items" : (name.charAt(0).toUpperCase() + name.slice(1));
        return '<button class="btn tab ' + (tab === name ? "active" : "") + '" type="button" data-project-tab="' + name + '">' + safe(label) + "</button>";
      }).join("") +
      '</section>' +
      tabContent +
      '</section>',
      { title: project.title, showBack: true }
    );

    document.querySelectorAll("[data-project-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        var nextTab = button.getAttribute("data-project-tab");
        go("/projects/" + project.id + "?tab=" + nextTab);
      });
    });

    document.querySelectorAll("[data-open-meeting]").forEach(function (button) {
      button.addEventListener("click", function () {
        var meeting = meetings.find(function (item) {
          return item.id === button.getAttribute("data-open-meeting");
        });
        if (meeting) {
          openMeetingDetail(meeting, projectStudents);
        }
      });
    });

    document.querySelectorAll("[data-download-file]").forEach(function (button) {
      button.addEventListener("click", function () {
        toast("Download simulated");
      });
    });

    var upload = el("file-upload");
    if (upload) {
      upload.addEventListener("change", function () {
        if (!upload.files || !upload.files[0]) {
          return;
        }
        var file = upload.files[0];
        Store.addFile(project.id, {
          name: file.name,
          size: file.size,
          type: file.type,
          uploaderId: state.user.id
        });
        toast("File metadata saved");
        renderProjectDetail(project.id);
      });
    }

    var applyStatus = el("apply-status");
    if (applyStatus) {
      applyStatus.addEventListener("click", function () {
        var result = Store.applyProjectStatusTransition(project.id, el("project-status-next").value, state.user.id);
        if (!result.ok) {
          toast(result.message || "Unable to update lifecycle.");
          return;
        }
        toast("Project status updated");
        renderProjectDetail(project.id);
      });
    }

    var editIntegrations = el("edit-integrations");
    if (editIntegrations) {
      editIntegrations.addEventListener("click", function () {
        openIntegrationsModal(project);
      });
    }
  }

  function githubFeed() {
    var projectStudents = students();
    return visibleProjects().map(function (project) {
      return (project.analytics.contributions || []).filter(function (entry) {
        return entry.commits > 0 || entry.prs > 0;
      }).map(function (entry) {
        var student = byId(projectStudents, entry.userId);
        return {
          id: project.id + "_" + entry.userId,
          message: "Contribution snapshot",
          author: student ? student.name : entry.userId,
          date: project.analytics.lastActivityAt,
          project: project.title,
          commits: entry.commits,
          prs: entry.prs
        };
      });
    }).reduce(function (acc, items) {
      return acc.concat(items);
    }, []).sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  }

  function jiraFeed() {
    var allStudents = students();
    return visibleProjects().map(function (project) {
      return Store.listActionItems(project.id).filter(function (item) {
        return !!item.jira;
      }).map(function (item) {
        var assignee = byId(allStudents, item.assigneeId || item.ownerId);
        return {
          id: item.id,
          key: item.jira.key,
          title: item.description,
          status: item.status,
          assignee: assignee ? assignee.name : (item.assigneeId || item.ownerId || "-"),
          project: project.title
        };
      });
    }).reduce(function (acc, items) {
      return acc.concat(items);
    }, []);
  }

  function renderActivity() {
    var tab = state.route.query.tab === "jira" ? "jira" : state.activityTab;
    if (tab !== "jira") {
      tab = "github";
    }
    state.activityTab = tab;

    var gitItems = githubFeed();
    var jiraItems = jiraFeed();

    renderShell(
      '<section class="screen">' +
      '<section class="segmented">' +
      '<button class="btn ' + (tab === "github" ? "active" : "") + '" type="button" data-activity-tab="github">GitHub</button>' +
      '<button class="btn ' + (tab === "jira" ? "active" : "") + '" type="button" data-activity-tab="jira">Jira</button>' +
      '</section>' +
      '<section class="stack">' +
      (tab === "github"
        ? (gitItems.length
          ? gitItems.map(function (item) {
            return '<article class="list-card"><h3>' + safe(item.message) + '</h3><p class="meta">' + safe(item.author) + " · " + safe(formatDateTime(item.date)) + '</p><p class="meta">' + safe(item.project) + " · " + item.commits + " commits · " + item.prs + ' PRs</p></article>';
          }).join("")
          : '<div class="empty">No GitHub activity snapshots available.</div>')
        : (jiraItems.length
          ? jiraItems.map(function (item) {
            return '<article class="list-card"><div class="list-card-head"><div><h3>' + safe(item.key) + '</h3><p class="meta">' + safe(item.project) + '</p></div><span class="badge info">' + safe(item.status) + '</span></div><p class="section-copy">' + safe(item.title) + '</p><p class="meta">Assignee: ' + safe(item.assignee) + '</p></article>';
          }).join("")
          : '<div class="empty">No Jira-linked action items available.</div>')) +
      '</section>' +
      '</section>'
    );

    document.querySelectorAll("[data-activity-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        go("/activity?tab=" + button.getAttribute("data-activity-tab"));
      });
    });
  }

  function renderSettings() {
    renderShell(
      '<section class="screen">' +
      '<section class="card"><div class="section-head"><div><h2>Profile</h2><p class="section-copy">Session and role details reused from the desktop prototype.</p></div></div>' +
      '<div class="meta-grid">' +
      '<div class="meta-item"><span class="meta-label">Name</span><span>' + safe(state.user.name) + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Role</span><span>' + safe(state.user.role) + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Email</span><span>' + safe(state.user.email) + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Projects</span><span>' + visibleProjects().length + '</span></div>' +
      '</div></section>' +
      '<section class="card"><div class="stack"><button class="btn primary block" id="logout-btn" type="button">Logout</button></div></section>' +
      '</section>'
    );

    el("logout-btn").addEventListener("click", function () {
      Store.clearSession();
      state.user = null;
      toast("Logged out");
      go("/login");
    });
  }

  function renderCurrentRoute() {
    state.route = parseRoute();
    if (!guardRoute(state.route)) {
      return;
    }

    if (state.route.path === "/login") {
      renderLogin();
      return;
    }

    if (state.route.path === "/dashboard") {
      renderDashboard();
      return;
    }

    if (state.route.path === "/projects") {
      renderProjects();
      return;
    }

    if (state.route.path === "/projects/:id") {
      renderProjectDetail(state.route.params.id);
      return;
    }

    if (state.route.path === "/activity") {
      renderActivity();
      return;
    }

    if (state.route.path === "/settings") {
      renderSettings();
      return;
    }

    go(state.user ? roleHome(state.user.role) : "/login");
  }

  function boot() {
    Store.init();
    if (!location.hash || location.hash.indexOf("#/") !== 0) {
      location.hash = "#/login";
    }
    window.addEventListener("hashchange", renderCurrentRoute);
    renderCurrentRoute();
  }

  boot();
})();
