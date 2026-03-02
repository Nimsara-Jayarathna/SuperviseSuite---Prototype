(function () {
  var state = {
    route: null,
    previousRoute: null,
    user: null,
    projectSearch: "",
    projectFilters: {
      status: "",
      semester: "",
      batch: ""
    },
    projectWizard: {
      step: 1,
      data: {
        title: "",
        batch: "2026",
        semester: "Semester 1",
        milestoneDate: "",
        studentIds: [],
        githubUrl: "",
        jiraProjectKey: "",
        jiraBoardLink: "",
        commsLink: ""
      }
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

    if (path === "/projects/new") {
      return {
        raw: raw,
        path: "/projects/new",
        params: {},
        query: query
      };
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

  function resetProjectWizard() {
    state.projectWizard = {
      step: 1,
      data: {
        title: "",
        batch: "2026",
        semester: "Semester 1",
        milestoneDate: "",
        studentIds: [],
        githubUrl: "",
        jiraProjectKey: "",
        jiraBoardLink: "",
        commsLink: ""
      }
    };
  }

  function statusCardClass(status) {
    var map = {
      ACTIVE: "status-active",
      AT_RISK: "status-at-risk",
      BEHIND: "status-behind",
      COMPLETED: "status-completed",
      ARCHIVED: "status-archived",
      DRAFT: "status-draft",
      CANCELLED: "status-cancelled"
    };
    return map[status] || "status-draft";
  }

  function icon(name) {
    var common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    if (name === "back") {
      return '<svg ' + common + '><path d="M15 18l-6-6 6-6"/><path d="M9 12h9"/></svg>';
    }
    if (name === "dashboard") {
      return '<svg ' + common + '><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></svg>';
    }
    if (name === "projects") {
      return '<svg ' + common + '><path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>';
    }
    if (name === "activity") {
      return '<svg ' + common + '><path d="M4 13h3l2-4 4 8 2-4h5"/><path d="M4 19h16"/></svg>';
    }
    if (name === "settings") {
      return '<svg ' + common + '><circle cx="12" cy="12" r="3.25"/><path d="M19.4 15a1 1 0 00.2 1.1l.1.1a1.2 1.2 0 010 1.7l-1.1 1.1a1.2 1.2 0 01-1.7 0l-.1-.1a1 1 0 00-1.1-.2 1 1 0 00-.6.9V21a1.2 1.2 0 01-1.2 1.2h-1.6A1.2 1.2 0 0111 21v-.2a1 1 0 00-.7-.9 1 1 0 00-1.1.2l-.1.1a1.2 1.2 0 01-1.7 0L6.3 19a1.2 1.2 0 010-1.7l.1-.1a1 1 0 00.2-1.1 1 1 0 00-.9-.6H5.5A1.2 1.2 0 014.3 14v-1.6a1.2 1.2 0 011.2-1.2h.2a1 1 0 00.9-.7 1 1 0 00-.2-1.1l-.1-.1a1.2 1.2 0 010-1.7l1.1-1.1a1.2 1.2 0 011.7 0l.1.1a1 1 0 001.1.2 1 1 0 00.6-.9V3.5A1.2 1.2 0 0112.1 2.3h1.6a1.2 1.2 0 011.2 1.2v.2a1 1 0 00.7.9 1 1 0 001.1-.2l.1-.1a1.2 1.2 0 011.7 0L19.7 5a1.2 1.2 0 010 1.7l-.1.1a1 1 0 00-.2 1.1 1 1 0 00.9.6h.2a1.2 1.2 0 011.2 1.2V11a1.2 1.2 0 01-1.2 1.2h-.2a1 1 0 00-.9.7z"/></svg>';
    }
    if (name === "profile") {
      return '<svg ' + common + '><circle cx="12" cy="8" r="3.25"/><path d="M5 19a7 7 0 0114 0"/></svg>';
    }
    if (name === "bell") {
      return '<svg ' + common + '><path d="M15 17H9"/><path d="M18 16V11a6 6 0 10-12 0v5l-2 2h16z"/></svg>';
    }
    if (name === "plus") {
      return '<svg ' + common + '><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
    }
    if (name === "check") {
      return '<svg ' + common + '><path d="M6 12.5l4 4L18 8.5"/></svg>';
    }
    if (name === "chevron-right") {
      return '<svg ' + common + '><path d="M9 6l6 6-6 6"/></svg>';
    }
    if (name === "chevron-down") {
      return '<svg ' + common + '><path d="M6 9l6 6 6-6"/></svg>';
    }
    return "";
  }

  function goBack(fallbackPath) {
    if (state.previousRoute) {
      go(state.previousRoute);
      return;
    }
    go(fallbackPath || roleHome(state.user ? state.user.role : "STUDENT"));
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

  function openActivityForBell() {
    if (!state.user) {
      go("/login");
      return;
    }
    go("/activity");
  }

  function notificationCount() {
    if (!state.user) {
      return 0;
    }

    if (isSupervisor()) {
      return visibleProjects().reduce(function (sum, project) {
        return sum + Store.listActionItems(project.id).filter(function (item) {
          return item.status !== "Done";
        }).length;
      }, 0);
    }

    return Store.listMyActionItems(state.user.id).filter(function (item) {
      return item.status !== "Done";
    }).length;
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

    if (route.path === "/projects/new" && !isSupervisor()) {
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
    var bellCount = notificationCount();
    var navItems = isSupervisor()
      ? [
        { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { path: "/projects", label: "Projects", icon: "projects" }
      ]
      : [
        { path: "/projects", label: "Projects", icon: "projects" },
        { path: "/settings", label: "Settings", icon: "settings" }
      ];

    appRoot.innerHTML =
      '<div class="mobile-shell">' +
      '<header class="topbar">' +
      '<div class="topbar-leading">' +
      (showBack
        ? '<button class="btn icon-btn soft" id="topbar-back" type="button" aria-label="Go back">' + icon("back") + '</button>'
        : '<button class="topbar-profile-trigger" id="topbar-profile-trigger" type="button" aria-label="Open profile and settings">' + icon("profile") + '</button>') +
      '</div>' +
      '<button class="topbar-title-button" id="topbar-title-trigger" type="button" aria-label="Open profile and settings">' +
      '<div class="topbar-title-copy"><span class="eyebrow">' + safe(title) + '</span><p class="topbar-profile-name">Hi, ' + safe(state.user.name) + '</p></div>' +
      '</button>' +
      '<div class="topbar-actions"><button class="btn icon-btn soft" id="topbar-bell" type="button" aria-label="Open action items"><span class="icon-badge-wrap">' + icon("bell") + (bellCount > 0 ? '<span class="icon-badge">' + Math.min(bellCount, 99) + '</span>' : "") + '</span></button></div>' +
      '</header>' +
      '<main class="app-main">' + contentHtml + "</main>" +
      '<nav class="nav-bottom">' +
      navItems.map(function (item) {
        var active = state.route.path === item.path || (item.path === "/projects" && state.route.path === "/projects/:id");
        return '<a class="nav-link ' + (active ? "active" : "") + '" href="#' + item.path + '"><span class="nav-icon">' + icon(item.icon) + '</span><span class="nav-label">' + safe(item.label) + "</span></a>";
      }).join("") +
      "</nav>" +
      "</div>";

    var back = el("topbar-back");
    if (back) {
      back.addEventListener("click", function () {
        goBack(state.route.path === "/projects/:id" ? "/projects" : roleHome(state.user.role));
      });
    }

    ["topbar-profile-trigger", "topbar-title-trigger"].forEach(function (id) {
      var trigger = el(id);
      if (!trigger) {
        return;
      }
      trigger.addEventListener("click", function () {
        if (state.route.path !== "/settings") {
          go("/settings");
        }
      });
    });

    var bell = el("topbar-bell");
    if (bell) {
      bell.addEventListener("click", function () {
        openActivityForBell();
      });
    }
  }

  function renderLogin() {
    appRoot.innerHTML =
      '<div class="login-shell">' +
      '<main class="card login-card">' +
      '<span class="eyebrow">SuperviseSuite</span>' +
      '<h1>Mobile Access</h1>' +
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
    return '<article class="project-card ' + statusCardClass(project.lifecycleStatus) + '">' +
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
      '<section class="card card-muted"><div class="section-head"><div><h2>Activity Summary</h2></div></div><div class="stack">' +
      activitySummary.map(function (item) {
        return '<div class="list-card">' + safe(item) + "</div>";
      }).join("") +
      '<button class="btn block cta-card-button" type="button" id="open-activity-cta"><span>Open Activity</span><span>' + icon("chevron-right") + '</span></button>' +
      '</div></section>' +
      '<section class="card"><div class="section-head"><div><h2>Priority Projects</h2></div><button class="btn text" type="button" id="see-all-projects">See all</button></div><div class="stack">' +
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
    var openActivity = el("open-activity-cta");
    if (openActivity) {
      openActivity.addEventListener("click", function () {
        go("/activity");
      });
    }
    bindProjectOpenButtons();
  }

  function openFilterModal(filterKey, label, options) {
    var current = state.projectFilters[filterKey] || "";
    var selectedValue = current;
    var body = '<div class="stack"><div class="sheet-options">' +
      [''].concat(options).map(function (option) {
        var value = option || "";
        var selected = value === selectedValue;
        return '<button class="sheet-option ' + (selected ? "is-selected" : "") + '" type="button" data-filter-option="' + safe(value) + '">' +
          '<span>' + safe(option || "All") + '</span><span class="sheet-option-mark" aria-hidden="true"></span></button>';
      }).join("") +
      '</div></div>';

    UI.openModal("Filter " + label, body, '<button class="btn ghost small" id="filter-clear">Clear</button><button class="btn primary small" id="filter-apply">Apply</button>');
    document.querySelectorAll("[data-filter-option]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectedValue = button.getAttribute("data-filter-option") || "";
        document.querySelectorAll("[data-filter-option]").forEach(function (node) {
          node.classList.toggle("is-selected", node === button);
        });
      });
    });
    el("filter-clear").addEventListener("click", function () {
      state.projectFilters[filterKey] = "";
      UI.closeModal();
      renderProjects();
    });
    el("filter-apply").addEventListener("click", function () {
      state.projectFilters[filterKey] = selectedValue;
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

    return '<article class="project-card ' + statusCardClass(project.lifecycleStatus) + '" data-open-project="' + safe(project.id) + '" role="button" tabindex="0">' +
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
      (isSupervisor() ? '<button class="btn projects-fab" id="new-project-fab" type="button" aria-label="Create new project">' + icon("plus") + '</button>' : "") +
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

    var newProject = el("new-project-fab");
    if (newProject) {
      newProject.addEventListener("click", function () {
        go("/projects/new");
      });
    }

    bindProjectOpenButtons();
  }

  function wizardIsDirty() {
    var data = state.projectWizard.data;
    return !!(
      data.title ||
      data.milestoneDate ||
      data.studentIds.length ||
      data.githubUrl ||
      data.jiraProjectKey ||
      data.jiraBoardLink ||
      data.commsLink ||
      data.batch !== "2026" ||
      data.semester !== "Semester 1"
    );
  }

  function validateWizardStepOne() {
    var data = state.projectWizard.data;
    if (!data.title || !data.milestoneDate || !data.studentIds.length) {
      toast("Please fill required fields in Step 1");
      return false;
    }
    return true;
  }

  function renderProjectWizard() {
    var data = state.projectWizard.data;
    var step = state.projectWizard.step;
    var allStudents = students();

    appRoot.innerHTML =
      '<div class="wizard-page">' +
      '<header class="topbar wizard-topbar">' +
      '<button class="btn icon-btn soft" id="wizard-exit" type="button" aria-label="Back to projects">' + icon("back") + '</button>' +
      '<div class="wizard-topbar-title">New Project</div>' +
      '<div class="wizard-topbar-spacer" aria-hidden="true"></div>' +
      '</header>' +
      '<main class="wizard-main">' +
      '<section class="screen">' +
      '<section class="wizard-stepper">' +
      '<button class="wizard-step ' + (step === 1 ? "active" : "") + '" type="button" data-wizard-step="1">1 Basic</button>' +
      '<button class="wizard-step ' + (step === 2 ? "active" : "") + '" type="button" data-wizard-step="2">2 Connections</button>' +
      '</section>' +
      (step === 1
        ? (
          '<section class="card wizard-card">' +
          '<div class="wizard-card-head"><h3>Project Basics</h3></div>' +
          '<div class="field"><label for="w-title">Project Title</label><input id="w-title" value="' + safe(data.title) + '" /></div>' +
          '<div class="field"><label for="w-batch">Batch</label><input id="w-batch" value="' + safe(data.batch) + '" /></div>' +
          '<div class="field"><label for="w-sem">Semester</label><select id="w-sem"><option ' + (data.semester === "Semester 1" ? "selected" : "") + '>Semester 1</option><option ' + (data.semester === "Semester 2" ? "selected" : "") + '>Semester 2</option></select></div>' +
          '<div class="field"><label for="w-milestone">Next Milestone Date</label><input id="w-milestone" type="date" value="' + safe(data.milestoneDate) + '" /></div>' +
          '</section>' +
          '<section class="card wizard-card">' +
          '<div class="wizard-card-head"><h3>Team Assignment</h3><span class="meta" id="wizard-selected-count">' + data.studentIds.length + ' selected</span></div>' +
          '<div class="wizard-student-list">' +
          allStudents.map(function (student) {
            var selected = data.studentIds.indexOf(student.id) > -1;
            return '<button class="wizard-student-row ' + (selected ? "is-selected" : "") + '" type="button" data-student-toggle="' + safe(student.id) + '"><span>' + safe(student.name) + '</span><span class="wizard-check">' + icon("check") + '</span></button>';
          }).join("") +
          '</div>' +
          '</section>'
        )
        : (
          '<section class="card wizard-card">' +
          '<div class="wizard-card-head"><h3>Connections</h3></div>' +
          '<div class="field"><label for="w-comms">Communication Link</label><input id="w-comms" value="' + safe(data.commsLink) + '" placeholder="https://teams.microsoft.com/..." /></div>' +
          '<div class="field"><label for="w-gh">GitHub Repo URL</label><input id="w-gh" value="' + safe(data.githubUrl) + '" placeholder="https://github.com/org/repo" /></div>' +
          '<div class="field"><label for="w-jira">Jira Project Key</label><input id="w-jira" value="' + safe(data.jiraProjectKey) + '" placeholder="ABC" /></div>' +
          '<div class="field"><label for="w-jira-board">Jira Board Link</label><input id="w-jira-board" value="' + safe(data.jiraBoardLink) + '" placeholder="https://jira.example.com/boards/123" /></div>' +
          '</section>'
        )) +
      '</section>' +
      '</main>' +
      '<div class="wizard-actionbar">' +
      (step === 2 ? '<button class="btn ghost wizard-secondary" id="wizard-back-step" type="button">Back</button>' : "") +
      '<button class="btn primary" id="wizard-primary" type="button">' + (step === 1 ? "Continue" : "Create Project") + '</button>' +
      '</div>' +
      '</div>';

    el("wizard-exit").addEventListener("click", function () {
      if (wizardIsDirty() && !window.confirm("Discard new project setup?")) {
        return;
      }
      resetProjectWizard();
      go("/projects");
    });

    document.querySelectorAll("[data-wizard-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        var nextStep = Number(button.getAttribute("data-wizard-step"));
        if (nextStep === step) {
          return;
        }
        if (nextStep === 2) {
          if (step === 1) {
            data.title = el("w-title").value.trim();
            data.batch = el("w-batch").value.trim() || "2026";
            data.semester = el("w-sem").value.trim() || "Semester 1";
            data.milestoneDate = el("w-milestone").value;
          }
          if (!validateWizardStepOne()) {
            return;
          }
        }
        state.projectWizard.step = nextStep;
        renderProjectWizard();
      });
    });

    if (step === 1) {
      ["w-title", "w-batch", "w-sem", "w-milestone"].forEach(function (id) {
        var node = el(id);
        if (!node) {
          return;
        }
        var eventName = id === "w-sem" ? "change" : "input";
        node.addEventListener(eventName, function () {
          data.title = el("w-title").value.trim();
          data.batch = el("w-batch").value.trim() || "2026";
          data.semester = el("w-sem").value.trim() || "Semester 1";
          data.milestoneDate = el("w-milestone").value;
        });
      });

      document.querySelectorAll("[data-student-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.getAttribute("data-student-toggle");
          var idx = data.studentIds.indexOf(id);
          if (idx > -1) {
            data.studentIds.splice(idx, 1);
          } else {
            data.studentIds.push(id);
          }
          renderProjectWizard();
        });
      });
    }

    if (step === 2) {
      ["w-comms", "w-gh", "w-jira", "w-jira-board"].forEach(function (id) {
        var node = el(id);
        if (!node) {
          return;
        }
        node.addEventListener("input", function () {
          data.commsLink = el("w-comms").value.trim();
          data.githubUrl = el("w-gh").value.trim();
          data.jiraProjectKey = el("w-jira").value.trim().toUpperCase();
          data.jiraBoardLink = el("w-jira-board").value.trim();
        });
      });
    }

    var backStep = el("wizard-back-step");
    if (backStep) {
      backStep.addEventListener("click", function () {
        if (step === 2) {
          data.commsLink = el("w-comms").value.trim();
          data.githubUrl = el("w-gh").value.trim();
          data.jiraProjectKey = el("w-jira").value.trim().toUpperCase();
          data.jiraBoardLink = el("w-jira-board").value.trim();
        }
        state.projectWizard.step = 1;
        renderProjectWizard();
      });
    }

    el("wizard-primary").addEventListener("click", function () {
      if (step === 1) {
        data.title = el("w-title").value.trim();
        data.batch = el("w-batch").value.trim() || "2026";
        data.semester = el("w-sem").value.trim() || "Semester 1";
        data.milestoneDate = el("w-milestone").value;
        if (!validateWizardStepOne()) {
          return;
        }
        state.projectWizard.step = 2;
        renderProjectWizard();
        return;
      }

      data.commsLink = el("w-comms").value.trim();
      data.githubUrl = el("w-gh").value.trim();
      data.jiraProjectKey = el("w-jira").value.trim().toUpperCase();
      data.jiraBoardLink = el("w-jira-board").value.trim();

      if (!data.commsLink) {
        toast("Communication link is required");
        return;
      }

      var created = Store.createProject(data, state.user.id);
      toast("Project created");
      resetProjectWizard();
      go("/projects/" + created.id);
    });
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
        '<div class="section-head"><div><h3>Project Snapshot</h3></div></div>' +
        '<p class="meta">' + safe(project.batch || "-") + " · " + safe(project.semester || "-") + '</p>' +
        '<div class="meta-grid">' +
        '<div class="meta-item"><span class="meta-label">Milestone</span><span>' + safe(milestoneText(project)) + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">Open / Overdue</span><span>' + summary.openActionItems + " / " + summary.overdueCount + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">Meetings</span><span>' + summary.meetingCount + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">Last Activity</span><span>' + safe(formatDateTime(project.analytics.lastActivityAt)) + '</span></div>' +
        '</div>' +
        '</div>' +
        '<div class="card"><div class="section-head"><div><h3>Members</h3></div></div><div class="inline-actions">' +
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
          ? '<div class="card"><div class="section-head"><div><h3>Lifecycle Control</h3></div></div><div class="stack"><select id="project-status-next">' +
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
        '<div class="card"><div class="section-head"><div><h3>GitHub</h3></div></div>' +
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
    var tab = state.route.query.tab === "jira"
      ? "jira"
      : (state.route.query.tab === "github" ? "github" : state.activityTab);
    if (tab !== "jira" && tab !== "github") {
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
      '<section class="card"><div class="section-head"><div><h2>Profile</h2></div></div>' +
      '<div class="meta-grid">' +
      '<div class="meta-item"><span class="meta-label">Name</span><span>' + safe(state.user.name) + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Role</span><span>' + safe(state.user.role) + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Email</span><span>' + safe(state.user.email) + '</span></div>' +
      '<div class="meta-item"><span class="meta-label">Projects</span><span>' + visibleProjects().length + '</span></div>' +
      '</div></section>' +
      '<section class="card"><div class="stack"><button class="btn primary block" id="logout-btn" type="button">Logout</button></div></section>' +
      '</section>',
      { showBack: true }
    );

    el("logout-btn").addEventListener("click", function () {
      Store.clearSession();
      state.user = null;
      toast("Logged out");
      go("/login");
    });
  }

  function renderCurrentRoute() {
    state.previousRoute = state.route ? state.route.raw : state.previousRoute;
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

    if (state.route.path === "/projects/new") {
      renderProjectWizard();
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
