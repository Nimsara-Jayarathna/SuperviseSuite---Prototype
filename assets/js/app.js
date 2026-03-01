(function () {
  var SESSION_TIMEOUT_MS = 1000 * 60 * 60 * 6;
  var state = {
    user: null,
    route: null,
    search: "",
    ui: {
      sidebarOpen: false
    }
  };

  var publicPaths = ["/", "/login", "/register", "/BAchecklist", "/BAchecklist.html"];
  var supervisorPrefix = "/supervisor";
  var studentPrefix = "/student";

  function el(id) {
    return document.getElementById(id);
  }

  function title(text) {
    return '<h1 class="page-title">' + UI.escapeHtml(text) + "</h1>";
  }

  function byId(arr, id) {
    return arr.find(function (x) { return x.id === id; });
  }

  function isPublicRoute(path) {
    return publicPaths.indexOf(path) > -1;
  }

  function roleHome(role) {
    return role === "SUPERVISOR" ? "/supervisor/dashboard" : "/student/projects";
  }

  function badgeClassForLifecycle(status) {
    if (status === "ACTIVE" || status === "COMPLETED" || status === "ARCHIVED") {
      return "on-track";
    }
    if (status === "AT_RISK" || status === "DRAFT") {
      return "at-risk";
    }
    return "behind";
  }

  function lifecycleBadge(status) {
    return '<span class="badge ' + badgeClassForLifecycle(status) + '">' + UI.escapeHtml(String(status || "DRAFT").replace("_", " ")) + "</span>";
  }

  function meetingStatusBadge(status) {
    if (status === "APPROVED") {
      return '<span class="badge on-track">APPROVED</span>';
    }
    if (status === "SUBMITTED") {
      return '<span class="badge at-risk">SUBMITTED</span>';
    }
    return '<span class="badge behind">DRAFT</span>';
  }

  function integrationBadge(name, status) {
    var cls = "at-risk";
    if (status === "CONNECTED") {
      cls = "on-track";
    } else if (status === "ERROR" || status === "NOT_CONFIGURED") {
      cls = "behind";
    }
    return '<span class="badge ' + cls + '">' + UI.escapeHtml(name + ": " + status) + "</span>";
  }

  function milestoneDeltaText(dateValue) {
    if (!dateValue) {
      return "No milestone set";
    }
    var target = new Date(dateValue);
    var today = new Date(new Date().toISOString().slice(0, 10));
    var diff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      return "Overdue by " + Math.abs(diff) + " day(s)";
    }
    if (diff === 0) {
      return "Due today";
    }
    return diff + " day(s) left";
  }

  function milestoneUrgency(dateValue) {
    if (!dateValue) {
      return { label: "No date", tone: "neutral" };
    }
    var target = new Date(dateValue);
    var today = new Date(new Date().toISOString().slice(0, 10));
    var diff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      return { label: "Overdue", tone: "critical" };
    }
    if (diff <= 7) {
      return { label: "Due soon", tone: "warning" };
    }
    return { label: "Planned", tone: "normal" };
  }

  function eventTypeLabel(type) {
    var map = {
      PROJECT_CREATED: "Project created",
      STATUS_CHANGED: "Status changed",
      MEETING_CREATED: "Meeting drafted",
      MEETING_SUBMITTED: "Meeting submitted",
      MEETING_APPROVED: "Meeting approved",
      ACTION_CREATED: "Action item created",
      ACTION_STATUS_CHANGED: "Action status changed",
      FILE_ADDED: "File added",
      INTEGRATION_UPDATED: "Integration updated"
    };
    return map[type] || type;
  }

  function getSessionState() {
    var session = Store.getSession();
    var authenticated = !!(session && session.userId && session.role);
    return { session: session, authenticated: authenticated };
  }

  function isSessionExpired(session) {
    if (!session || !session.userId || !session.lastActiveAt) {
      return false;
    }
    return new Date().getTime() - new Date(session.lastActiveAt).getTime() > SESSION_TIMEOUT_MS;
  }

  function clearReturnTo(session) {
    if (!session || !session.userId) {
      return;
    }
    session.returnTo = null;
    Store.setSession(session);
  }

  function consumeReturnTo(session) {
    if (!session || !session.returnTo) {
      return null;
    }
    var target = session.returnTo;
    clearReturnTo(session);
    return target;
  }

  function rememberReturnTo(rawRoute) {
    var target = rawRoute || location.pathname || "/";
    if (!target.startsWith("/")) {
      target = "/";
    }
    var session = Store.getSession() || {};
    session.returnTo = target;
    Store.setSession(session);
  }

  function toggleSidebar(open) {
    var shell = el("app-shell");
    var overlay = el("shell-overlay");
    state.ui.sidebarOpen = !!open;

    if (!shell || !overlay) {
      return;
    }

    shell.classList.toggle("sidebar-open", state.ui.sidebarOpen);
    overlay.classList.toggle("hidden", !state.ui.sidebarOpen);
  }

  function closeSidebar() {
    toggleSidebar(false);
  }

  function sidebarHtml() {
    if (!state.user) {
      return "";
    }

    var items = state.user.role === "SUPERVISOR"
      ? [
        { key: "dashboard", label: "Dashboard", path: "/supervisor/dashboard" },
        { key: "projects", label: "Projects", path: "/supervisor/projects" }
      ]
      : [
        { key: "projects", label: "My Projects", path: "/student/projects" }
      ];

    var activePath = state.route ? state.route.path : "";

    return '<div class="brand">SuperviseSuite</div><div class="nav-group">' +
      items.map(function (item) {
        var isActive = activePath.indexOf(item.path) === 0 || (activePath.indexOf("/projects/:id") !== -1 && item.key === "projects");
        return '<button class="nav-item ' + (isActive ? "active" : "") + '" data-nav="' + item.path + '">' + UI.escapeHtml(item.label) + "</button>";
      }).join("") +
      "</div>";
  }

  function topbarHtml() {
    if (!state.user) {
      return "";
    }

    return '<div class="topbar-left"><div class="search-wrap search-wrap-enhanced"><span class="search-icon" aria-hidden="true">&#128269;</span><input class="search-input" id="global-search" placeholder="Search projects, students, milestones..." value="' + UI.escapeHtml(state.search) + '"/></div></div>' +
      '<div class="topbar-right"><span class="topbar-role">' + UI.escapeHtml(state.user.role) + '</span><strong class="topbar-user">' + UI.escapeHtml(state.user.name) + '</strong><button class="btn small topbar-logout" id="logout-btn">Logout</button></div>';
  }

  function enforceRouteGuards(route) {
    var ss = getSessionState();
    var session = ss.session;

    if (ss.authenticated && isSessionExpired(session)) {
      Store.clearSession();
      state.user = null;
      UI.toast("Session expired");
      Router.go("/login");
      return false;
    }

    if (!ss.authenticated && !isPublicRoute(route.path)) {
      rememberReturnTo(route.raw);
      Router.go("/login");
      return false;
    }

    if (!ss.authenticated) {
      state.user = null;
      return true;
    }

    state.user = Store.getCurrentUser();
    if (!state.user) {
      Store.clearSession();
      Router.go("/login");
      return false;
    }

    Store.touchSession();

    if (route.path === "/" || route.path === "/login" || route.path === "/register") {
      Router.go(roleHome(state.user.role));
      return false;
    }

    if (state.user.role === "STUDENT" && route.path.startsWith(supervisorPrefix)) {
      Router.go("/student/projects");
      return false;
    }

    if (state.user.role === "SUPERVISOR" && route.path.startsWith(studentPrefix)) {
      Router.go("/supervisor/dashboard");
      return false;
    }

    // Role-specific project access
    if (route.path.indexOf("/projects/:id") !== -1) {
      var project = Store.getProjectById(route.params.id);
      if (!project) {
        Router.go(roleHome(state.user.role));
        return false;
      }
      if (state.user.role === "STUDENT" && project.studentIds.indexOf(state.user.id) === -1) {
        Router.go("/student/projects");
        return false;
      }
    }

    return true;
  }

  function bindShellEvents() {
    document.querySelectorAll("[data-nav]").forEach(function (button) {
      button.addEventListener("click", function () {
        closeSidebar();
        Router.go(button.getAttribute("data-nav"));
      });
    });

    var logout = el("logout-btn");
    if (logout) {
      logout.addEventListener("click", function () {
        Store.clearSession();
        state.user = null;
        closeSidebar();
        UI.toast("Logged out");
        Router.go("/");
      });
    }

    var gs = el("global-search");
    if (gs) {
      gs.addEventListener("input", function () {
        state.search = gs.value.trim();
        renderCurrentRoute();
      });
    }

    var overlay = el("shell-overlay");
    if (overlay) {
      overlay.onclick = function () {
        closeSidebar();
      };
    }
  }

  function renderLayout(contentHtml) {
    var shell = el("app-shell");
    var path = state.route ? state.route.path : "";
    var isPublicDocShell = path === "/BAchecklist";
    var isPublicShell = (!state.user && isPublicRoute(path)) || isPublicDocShell;

    shell.classList.toggle("public-shell", isPublicShell);
    shell.classList.toggle("public-doc-shell", isPublicDocShell);

    if (isPublicShell || (state.user && state.user.role === "STUDENT")) {
      el("sidebar").classList.add("hidden");
      el("topbar").classList.add("hidden");
      closeSidebar();
    } else {
      el("sidebar").classList.remove("hidden");
      el("topbar").classList.remove("hidden");
    }

    el("sidebar").innerHTML = sidebarHtml();
    el("topbar").innerHTML = topbarHtml();
    el("content").innerHTML = contentHtml;
    bindShellEvents();
  }

  function loginWithCredentials(email, password) {
    var session = Store.login(email, password);
    if (!session) {
      return null;
    }
    var returnTo = consumeReturnTo(session);
    return returnTo || roleHome(session.role);
  }

  function renderLanding() {
    renderLayout(
      '<section class="landing">' +
      '<div class="card landing-hero">' +
      '<h1 class="page-title">SuperviseSuite</h1>' +
      '<p class="landing-tagline">Track project portfolios, meetings, action items, and progress insights in one supervisor workspace.</p>' +
      '<div class="row wrap" style="margin-top:14px">' +
      '<button class="btn primary" id="landing-login">Login</button>' +
      '<button class="btn" id="landing-register">Register</button>' +
      '<button class="btn ghost" id="landing-ba">BA Checklist</button>' +
      '</div></div>' +
      '<div class="grid cards-4" style="margin-top:14px">' +
      '<div class="card"><div class="metric-label">Role-Based Access</div><div class="meta">Supervisor and student views with centralized route guards.</div></div>' +
      '<div class="card"><div class="metric-label">Project Workspace</div><div class="meta">Overview, activity, meetings, action items, and files metadata tabs.</div></div>' +
      '<div class="card"><div class="metric-label">Monitoring Widgets</div><div class="meta">Dashboard metrics, project health table, and mock trend charts.</div></div>' +
      '<div class="card"><div class="metric-label">Simulation Layer</div><div class="meta">Mock integrations for GitHub/Jira and async-like interactions.</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px">' +
      '<h3 style="margin:0 0 10px">Quick Demo Access</h3>' +
      '<div class="row wrap">' +
      '<button class="btn" data-demo-login="supervisor@demo.com">Supervisor Demo</button>' +
      '<button class="btn" data-demo-login="student1@demo.com">Student 1 Demo</button>' +
      '<button class="btn" data-demo-login="student2@demo.com">Student 2 Demo</button>' +
      '</div></div>' +
      '<div class="notice" style="margin-top:12px">Prototype disclaimer: this build runs entirely on localStorage, integrations are simulated, and file uploads store metadata only.</div>' +
      '</section>'
    );

    el("landing-login").addEventListener("click", function () {
      Router.go("/login");
    });
    el("landing-register").addEventListener("click", function () {
      Router.go("/register");
    });
    el("landing-ba").addEventListener("click", function () {
      Router.go("/BAchecklist.html");
    });

    document.querySelectorAll("[data-demo-login]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = loginWithCredentials(btn.getAttribute("data-demo-login"), "demo123");
        if (!target) {
          UI.toast("Demo login failed");
          return;
        }
        UI.toast("Login successful");
        Router.go(target);
      });
    });
  }

  function renderLogin() {
    renderLayout(
      '<div class="login-wrap card">' +
      title("Supervisor Project Portfolio") +
      '<p class="notice">Use demo accounts or login manually.</p>' +
      '<div class="row wrap" style="margin-bottom:10px">' +
      '<button class="btn" data-demo="supervisor@demo.com">Supervisor Demo</button>' +
      '<button class="btn" data-demo="student1@demo.com">Student 1 Demo</button>' +
      '<button class="btn" data-demo="student2@demo.com">Student 2 Demo</button>' +
      "</div>" +
      '<div class="form-grid">' +
      '<div class="full"><label>Email</label><input id="login-email" value="supervisor@demo.com"/></div>' +
      '<div class="full"><label>Password</label><input id="login-password" type="password" value="demo123"/></div>' +
      "</div>" +
      '<div class="row" style="justify-content:space-between;margin-top:10px"><a href="/register" class="btn ghost">Create account</a><button class="btn primary" id="login-submit">Login</button></div>' +
      '<p class="notice">All seeded demo accounts use password: <strong>demo123</strong></p>' +
      "</div>"
    );

    document.querySelectorAll("[data-demo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        el("login-email").value = btn.getAttribute("data-demo");
        el("login-password").value = "demo123";
      });
    });

    el("login-submit").addEventListener("click", function () {
      var email = el("login-email").value.trim();
      var password = el("login-password").value.trim();
      var target = loginWithCredentials(email, password);
      if (!target) {
        UI.toast("Invalid credentials");
        return;
      }
      UI.toast("Login successful");
      Router.go(target);
    });
  }

  function renderRegister() {
    var submitting = false;

    renderLayout(
      '<div class="login-wrap card">' +
      title("Create Account") +
      '<p class="notice">New registrations create student accounts for this local prototype.</p>' +
      '<div class="form-grid">' +
      '<div class="full"><label>Full Name</label><input id="reg-name" placeholder="Your full name"/><div class="field-error" id="reg-name-err"></div></div>' +
      '<div class="full"><label>Email</label><input id="reg-email" placeholder="name@example.com"/><div class="field-error" id="reg-email-err"></div></div>' +
      '<div><label>Password</label><input id="reg-password" type="password"/><div class="field-error" id="reg-password-err"></div></div>' +
      '<div><label>Confirm Password</label><input id="reg-confirm" type="password"/><div class="field-error" id="reg-confirm-err"></div></div>' +
      '<div class="full"><label>Role</label><select id="reg-role"><option value="STUDENT">Student</option></select></div>' +
      '</div>' +
      '<div class="row" style="justify-content:space-between;margin-top:12px"><a href="/login" class="btn ghost">Back to login</a><button class="btn primary" id="reg-submit">Register</button></div>' +
      '</div>'
    );

    function setError(id, message) {
      var node = el(id);
      if (node) {
        node.textContent = message || "";
      }
    }

    function clearErrors() {
      setError("reg-name-err", "");
      setError("reg-email-err", "");
      setError("reg-password-err", "");
      setError("reg-confirm-err", "");
    }

    function validate(payload) {
      clearErrors();
      var ok = true;
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!payload.fullName) {
        setError("reg-name-err", "Full name is required.");
        ok = false;
      }
      if (!payload.email) {
        setError("reg-email-err", "Email is required.");
        ok = false;
      } else if (!emailRegex.test(payload.email)) {
        setError("reg-email-err", "Enter a valid email address.");
        ok = false;
      } else if (Store.emailExists(payload.email)) {
        setError("reg-email-err", "This email is already in use.");
        ok = false;
      }
      if (!payload.password) {
        setError("reg-password-err", "Password is required.");
        ok = false;
      } else if (payload.password.length < 8) {
        setError("reg-password-err", "Password must be at least 8 characters.");
        ok = false;
      }
      if (payload.confirmPassword !== payload.password) {
        setError("reg-confirm-err", "Passwords do not match.");
        ok = false;
      }

      return ok;
    }

    el("reg-submit").addEventListener("click", function () {
      if (submitting) {
        return;
      }

      var payload = {
        fullName: el("reg-name").value.trim(),
        email: el("reg-email").value.trim(),
        password: el("reg-password").value,
        confirmPassword: el("reg-confirm").value,
        role: el("reg-role").value
      };

      if (!validate(payload)) {
        return;
      }

      submitting = true;
      el("reg-submit").disabled = true;
      el("reg-submit").textContent = "Creating...";

      Store.simulate({}, 500).then(function () {
        var result = Store.registerUser(payload);
        if (!result.ok) {
          submitting = false;
          el("reg-submit").disabled = false;
          el("reg-submit").textContent = "Register";
          setError("reg-email-err", result.error || "Registration failed.");
          return;
        }

        var target = loginWithCredentials(payload.email, payload.password);
        UI.toast("Registration successful");
        Router.go(target || "/student/projects");
      });
    });
  }

  function dashboardSkeleton() {
    renderLayout(
      title("Supervisor Dashboard") +
      '<div class="grid cards-5" style="margin-bottom:14px">' +
      '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>' +
      "</div>" +
      '<div class="skeleton" style="height:260px"></div>'
    );
  }

  function projectMatchesSearch(project, users) {
    if (!state.search) {
      return true;
    }
    var term = state.search.toLowerCase();
    var names = project.studentIds.map(function (id) {
      var u = byId(users, id);
      return u ? u.name.toLowerCase() : "";
    }).join(" ");
    return project.title.toLowerCase().indexOf(term) > -1 || names.indexOf(term) > -1;
  }

  function renderDashboard() {
    dashboardSkeleton();
    var projects = Store.getProjectsForUser(state.user);
    var users = Store.listStudents();
    var pageSize = 8;
    var currentPage = 1;

    Store.simulate({ projects: projects, stats: Store.statsForDashboard(projects) }).then(function (payload) {
      var visibleProjects = payload.projects.filter(function (p) { return projectMatchesSearch(p, users); });

      function rowForProject(p) {
        var summary = Store.getProjectSummary(p.id) || { openActionItems: 0, overdueCount: 0, meetingCount: 0 };
        var hasIntegrationIssues = p.githubIntegration.status !== "CONNECTED" || p.jiraIntegration.status !== "CONNECTED" || p.commsIntegration.status !== "CONNECTED";
        var milestone = milestoneUrgency(p.milestoneDate);
        var rowTone = summary.overdueCount > 0 || p.lifecycleStatus === "BEHIND"
          ? "critical"
          : (p.lifecycleStatus === "AT_RISK" ? "warning" : "normal");
        return '<tr>' +
          '<td><div class="scan-project"><strong>' + UI.escapeHtml(p.title) + '</strong>' + (hasIntegrationIssues ? ' <span class="scan-flag">Integration issue</span>' : "") + '</div></td>' +
          '<td>' + lifecycleBadge(p.lifecycleStatus) + (p.healthSuggestedStatus ? ' <span class="badge at-risk">Suggested ' + UI.escapeHtml(p.healthSuggestedStatus) + "</span>" : "") + '</td>' +
          '<td><div>' + UI.formatDateTime(p.analytics.lastActivityAt) + '</div></td>' +
          '<td><span class="scan-count scan-count-neutral">' + summary.openActionItems + '</span></td>' +
          '<td><span class="scan-count ' + (summary.overdueCount > 0 ? "scan-count-critical" : "scan-count-ok") + '">' + summary.overdueCount + '</span></td>' +
          '<td><div>' + UI.formatDate(p.milestoneDate) + '</div><div class="meta"><span class="scan-urgency scan-urgency-' + milestone.tone + '">' + milestone.label + '</span> ' + milestoneDeltaText(p.milestoneDate) + '</div></td>' +
          '<td><div class="quick-actions quick-actions-' + rowTone + '"><button class="btn small action-btn-open" data-open-project="' + p.id + '">Open</button> <button class="btn small action-btn-meetings" data-open-tab="meetings" data-open-project="' + p.id + '">Meetings</button> <button class="btn small action-btn-files" data-open-tab="files" data-open-project="' + p.id + '">Files</button></div></td>' +
          "</tr>";
      }

      function renderDashboardPage() {
        var totalVisible = visibleProjects.length;
        var totalPages = Math.max(1, Math.ceil(totalVisible / pageSize));
        var activeSearch = state.search ? state.search.trim() : "";
        var hasActiveFilter = !!activeSearch;
        if (currentPage > totalPages) {
          currentPage = totalPages;
        }
        var startIdx = totalVisible === 0 ? 0 : (currentPage - 1) * pageSize;
        var endIdxExclusive = Math.min(startIdx + pageSize, totalVisible);
        var startLabel = totalVisible === 0 ? 0 : startIdx + 1;
        var endLabel = totalVisible === 0 ? 0 : endIdxExclusive;
        var pageProjects = visibleProjects.slice(startIdx, endIdxExclusive);
        var rows = pageProjects.map(rowForProject).join("");
        var pagination = totalVisible > pageSize
          ? '<div class="dashboard-pagination row wrap"><button class="btn small" id="dashboard-prev" ' + (currentPage === 1 ? "disabled" : "") + '>Previous</button><span class="meta">Page ' + currentPage + ' of ' + totalPages + '</span><button class="btn small" id="dashboard-next" ' + (currentPage === totalPages ? "disabled" : "") + '>Next</button></div>'
          : "";
        var tableMeta = hasActiveFilter
          ? 'Showing ' + startLabel + "-" + endLabel + " of " + totalVisible + ' matching search'
          : 'Showing ' + startLabel + "-" + endLabel + " of " + totalVisible + ' projects';
        var filterChip = hasActiveFilter
          ? '<span class="badge info">Search: ' + UI.escapeHtml(activeSearch) + '</span>'
          : "";

        renderLayout(
          '<div class="dashboard-head card"><div class="dashboard-head-inner"><div><h1 class="page-title dashboard-title">Dashboard</h1></div><div class="dashboard-head-kpis"><span class="badge on-track">Visible projects: ' + visibleProjects.length + '</span><span class="badge at-risk">Overdue: ' + payload.stats.overdue + '</span><button class="btn small ghost" id="dashboard-ba-btn">BA Checklist</button></div></div></div>' +
          '<div class="grid cards-5 dashboard-kpis" style="margin-bottom:14px">' +
          metricCard("Total Projects", payload.stats.total) +
          metricCard("On Track", payload.stats.onTrack) +
          metricCard("At Risk", payload.stats.atRisk) +
          metricCard("Behind", payload.stats.behind) +
          metricCard("Overdue Action Items", payload.stats.overdue) +
          "</div>" +
          '<div class="card project-health-card" style="margin-bottom:14px"><div class="row wrap" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Project Health</h3><div class="row wrap">' + filterChip + '<div class="meta">' + tableMeta + '</div></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Project</th><th>Status</th><th>Last Activity</th><th>Open Actions</th><th>Overdue</th><th>Next Milestone</th><th>Quick Actions</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="7"><div class="empty">No projects match current search.</div></td></tr>') +
          "</tbody></table></div>" + pagination + "</div>" +
          '<div class="split"><div class="card"><h3 style="margin:0 0 10px">Activity Over Time</h3><canvas id="activity-line" width="620" height="220"></canvas></div><div class="card"><h3 style="margin:0 0 10px">Commits by Project</h3><canvas id="activity-bars" width="310" height="220"></canvas></div></div>'
        );

        var weeks = ["W-5", "W-4", "W-3", "W-2", "W-1", "Now"];
        var sums = [0, 0, 0, 0, 0, 0];
        payload.projects.forEach(function (p) {
          p.analytics.activityWeeks.forEach(function (v, idx) {
            sums[idx] += v;
          });
        });
        Charts.drawLineChart("activity-line", sums, weeks);
        Charts.drawBars("activity-bars", payload.projects.slice(0, 5).map(function (p) {
          return { label: p.title.split(" ")[0], value: p.analytics.commitsWeek };
        }));

        var prev = el("dashboard-prev");
        if (prev) {
          prev.addEventListener("click", function () {
            if (currentPage > 1) {
              currentPage -= 1;
              renderDashboardPage();
            }
          });
        }
        var next = el("dashboard-next");
        if (next) {
          next.addEventListener("click", function () {
            if (currentPage < totalPages) {
              currentPage += 1;
              renderDashboardPage();
            }
          });
        }
        var baBtn = el("dashboard-ba-btn");
        if (baBtn) {
          baBtn.addEventListener("click", function () {
            Router.go("/BAchecklist.html");
          });
        }
        bindOpenProjectButtons();
      }
      renderDashboardPage();
    });
  }

  function metricCard(label, value) {
    return '<div class="card kpi-card"><div class="metric-label">' + UI.escapeHtml(label) + '</div><div class="metric-value">' + value + "</div></div>";
  }

  function bindOpenProjectButtons() {
    document.querySelectorAll("[data-open-project]").forEach(function (node) {
      var openProject = function () {
        var id = node.getAttribute("data-open-project");
        var tab = node.getAttribute("data-open-tab");
        var prefix = state.user.role === "SUPERVISOR" ? supervisorPrefix : studentPrefix;
        var target = prefix + "/projects/" + id;
        if (tab) {
          target += "?tab=" + tab;
        }
        Router.go(target);
      };

      node.addEventListener("click", openProject);
      node.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProject();
        }
      });
    });
  }

  function renderProjectsList() {
    var projects = Store.getProjectsForUser(state.user);
    var users = Store.listStudents();

    renderLayout(
      '<div class="row wrap" style="justify-content:space-between;align-items:center;margin-bottom:16px"><h1 class="page-title" style="margin:0">' + (state.user.role === "SUPERVISOR" ? "All Projects" : "My Projects") + '</h1>' +
      (state.user.role === "STUDENT" ? '<button class="btn ghost" id="student-logout-btn">Logout</button>' : "") + '</div>' +
      '<div class="card" style="margin-bottom:14px"><div class="row wrap">' +
      '<input id="project-search" placeholder="Search by title/student" style="max-width:240px" value="' + UI.escapeHtml(state.search) + '" />' +
      '<select id="filter-status" style="max-width:180px"><option value="">All Lifecycle</option><option value="DRAFT">DRAFT</option><option value="ACTIVE">ACTIVE</option><option value="AT_RISK">AT_RISK</option><option value="BEHIND">BEHIND</option><option value="COMPLETED">COMPLETED</option><option value="ARCHIVED">ARCHIVED</option></select>' +
      '<select id="filter-integration" style="max-width:220px"><option value="">All Integrations</option><option value="github">GitHub Connected</option><option value="jira">Jira Connected</option><option value="none">No Integrations</option></select>' +
      (state.user.role === "SUPERVISOR" ? '<button class="btn primary" id="new-project-btn">New Project</button>' : "") +
      "</div></div>" +
      '<div id="projects-grid" class="projects-grid"></div>'
    );

    function applyFilters() {
      var q = el("project-search").value.trim().toLowerCase();
      var status = el("filter-status").value;
      var integ = el("filter-integration").value;

      var html = projects.filter(function (p) {
        var names = p.studentIds.map(function (sid) { var u = byId(users, sid); return u ? u.name.toLowerCase() : ""; }).join(" ");
        var matchQ = !q || p.title.toLowerCase().indexOf(q) > -1 || names.indexOf(q) > -1;
        var matchStatus = !status || p.lifecycleStatus === status;
        var matchInteg = !integ ||
          (integ === "github" && p.githubIntegration.status === "CONNECTED") ||
          (integ === "jira" && p.jiraIntegration.status === "CONNECTED") ||
          (integ === "none" && p.githubIntegration.status === "NOT_CONFIGURED" && p.jiraIntegration.status === "NOT_CONFIGURED" && p.commsIntegration.status === "NOT_CONFIGURED");
        return matchQ && matchStatus && matchInteg;
      }).map(function (p) {
        var summary = Store.getProjectSummary(p.id) || { openActionItems: 0, overdueCount: 0, meetingCount: 0 };
        return '<div class="card project-card project-card-link" data-open-project="' + p.id + '" role="button" tabindex="0">' +
          '<h3>' + UI.escapeHtml(p.title) + '</h3>' +
          '<div class="meta">Students: ' + p.studentIds.length + ' | Last activity: ' + UI.formatDateTime(p.analytics.lastActivityAt) + '</div>' +
          '<div class="meta">Milestone: ' + UI.formatDate(p.milestoneDate) + " • " + UI.escapeHtml(milestoneDeltaText(p.milestoneDate)) + '</div>' +
          '<div class="row wrap" style="margin:8px 0">' +
          lifecycleBadge(p.lifecycleStatus) +
          (p.healthSuggestedStatus ? '<span class="badge at-risk">Suggested: ' + UI.escapeHtml(p.healthSuggestedStatus) + '</span>' : "") +
          integrationBadge("GitHub", p.githubIntegration.status) +
          integrationBadge("Jira", p.jiraIntegration.status) +
          integrationBadge("Comms", p.commsIntegration.status) +
          '</div>' +
          '<div class="meta">Open actions: ' + summary.openActionItems + " | Overdue: " + summary.overdueCount + " | Meetings: " + summary.meetingCount + '</div>' +
          "</div>";
      }).join("");

      el("projects-grid").innerHTML = html || (state.user.role === "SUPERVISOR"
        ? '<div class="empty">No projects yet. Create your first project.</div>'
        : '<div class="empty">No assigned projects yet. Contact your supervisor.</div>');
      bindOpenProjectButtons();
    }

    ["project-search", "filter-status", "filter-integration"].forEach(function (id) {
      el(id).addEventListener("input", applyFilters);
      el(id).addEventListener("change", applyFilters);
    });

    var np = el("new-project-btn");
    if (np) {
      np.addEventListener("click", function () {
        Router.go("/supervisor/projects/new");
      });
    }

    var sl = el("student-logout-btn");
    if (sl) {
      sl.addEventListener("click", function () {
        Store.clearSession();
        state.user = null;
        UI.toast("Logged out");
        Router.go("/");
      });
    }

    applyFilters();
  }

  function renderProjectWizard() {
    var students = Store.listStudents();
    var step = 1;
    var data = {
      title: "",
      batch: "2026",
      semester: "Semester 1",
      milestoneDate: "",
      studentIds: [],
      githubUrl: "",
      jiraProjectKey: "",
      jiraBoardLink: "",
      commsLink: ""
    };

    function selectedStudentCount() {
      return data.studentIds.length;
    }

    function screen() {
      var html = title("Create New Project") +
        '<div class="row wrap" style="justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<div class="meta">Need requirement confirmation before setup? Open the BA checklist.</div>' +
        '<button class="btn small ghost" id="wizard-ba-checklist">BA Checklist</button>' +
        '</div><div class="card wizard-shell">';
      html += '<div class="wizard-steps"><span class="wizard-step ' + (step === 1 ? "active" : "") + '">Step 1: Basic Info</span><span class="wizard-step ' + (step === 2 ? "active" : "") + '">Step 2: Connections</span></div>';
      if (step === 1) {
        html += '<div class="wizard-section"><h3>Project Basics</h3><div class="meta">Capture the core identity and delivery timeline.</div><div class="form-grid">' +
          '<div class="full"><label>Project Title *</label><input id="w-title" placeholder="e.g., Smart Attendance Tracker" value="' + UI.escapeHtml(data.title) + '"/></div>' +
          '<div><label>Batch</label><input id="w-batch" value="' + UI.escapeHtml(data.batch) + '"/></div>' +
          '<div><label>Semester</label><input id="w-sem" value="' + UI.escapeHtml(data.semester) + '"/></div>' +
          '<div><label>Next Milestone Date *</label><input id="w-milestone" type="date" value="' + UI.escapeHtml(data.milestoneDate) + '"/></div>' +
          '</div></div>' +
          '<div class="wizard-section"><div class="row wrap" style="justify-content:space-between"><h3 style="margin:0">Team Assignment</h3><div class="meta" id="w-student-count">' + selectedStudentCount() + ' selected</div></div><div class="meta">Choose at least one student to continue.</div><div class="wizard-students">' +
          students.map(function (s) {
            var checked = data.studentIds.indexOf(s.id) > -1 ? "checked" : "";
            return '<label class="student-pick"><input type="checkbox" data-student="' + s.id + '" ' + checked + '/><span>' + UI.escapeHtml(s.name) + "</span></label>";
          }).join("") +
          "</div></div>";
      } else {
        html += '<div class="wizard-section"><h3>Communication & Integrations</h3><div class="meta">Configure collaboration channel first, then optional tooling links.</div><div class="form-grid">' +
          '<div class="full"><label>Communication Link * (Teams/Discord/WhatsApp)</label><input id="w-comms" placeholder="https://teams.microsoft.com/..." value="' + UI.escapeHtml(data.commsLink) + '"/></div>' +
          '<div class="full"><label>GitHub Repo URL</label><input id="w-gh" placeholder="https://github.com/org/repo" value="' + UI.escapeHtml(data.githubUrl) + '"/></div>' +
          '<div><label>Jira Project Key</label><input id="w-jira" placeholder="ABC" value="' + UI.escapeHtml(data.jiraProjectKey) + '"/></div>' +
          '<div><label>Jira Board Link (optional)</label><input id="w-jira-board" placeholder="https://jira.example.com/boards/123" value="' + UI.escapeHtml(data.jiraBoardLink) + '"/></div>' +
          "</div></div>";
      }
      html += '<div class="wizard-footer row wrap" style="justify-content:flex-end;margin-top:14px">';
      if (step === 2) {
        html += '<button class="btn" id="wizard-back">Back</button>';
      }
      html += '<button class="btn primary" id="wizard-next">' + (step === 1 ? "Continue" : "Create Project") + "</button></div></div>";

      renderLayout(html);
      bindWizardEvents();
    }

    function bindWizardEvents() {
      var next = el("wizard-next");
      next.addEventListener("click", function () {
        if (step === 1) {
          data.title = el("w-title").value.trim();
          data.batch = el("w-batch").value.trim() || "2026";
          data.semester = el("w-sem").value.trim() || "Semester 1";
          data.milestoneDate = el("w-milestone").value;
          data.studentIds = Array.prototype.slice.call(document.querySelectorAll("[data-student]:checked")).map(function (c) {
            return c.getAttribute("data-student");
          });
          if (!data.title || !data.milestoneDate || !data.studentIds.length) {
            UI.toast("Please fill required fields in Step 1");
            return;
          }
          step = 2;
          screen();
        } else {
          data.commsLink = el("w-comms").value.trim();
          data.githubUrl = el("w-gh").value.trim();
          data.jiraProjectKey = el("w-jira").value.trim().toUpperCase();
          data.jiraBoardLink = el("w-jira-board").value.trim();
          if (!data.commsLink) {
            UI.toast("Communication link is required");
            return;
          }
          var created = Store.createProject(data, state.user.id);
          UI.toast("Project created");
          Router.go("/projects/" + created.id);
        }
      });

      document.querySelectorAll("[data-student]").forEach(function (node) {
        node.addEventListener("change", function () {
          data.studentIds = Array.prototype.slice.call(document.querySelectorAll("[data-student]:checked")).map(function (c) {
            return c.getAttribute("data-student");
          });
          var countNode = el("w-student-count");
          if (countNode) {
            countNode.textContent = data.studentIds.length + " selected";
          }
        });
      });

      var back = el("wizard-back");
      if (back) {
        back.addEventListener("click", function () {
          data.commsLink = el("w-comms").value.trim();
          data.githubUrl = el("w-gh").value.trim();
          data.jiraProjectKey = el("w-jira").value.trim().toUpperCase();
          data.jiraBoardLink = el("w-jira-board").value.trim();
          step = 1;
          screen();
        });
      }

      var checklistBtn = el("wizard-ba-checklist");
      if (checklistBtn) {
        checklistBtn.addEventListener("click", function () {
          Router.go("/BAchecklist.html");
        });
      }
    }

    screen();
  }

  function renderProjectView(projectId, activeTab) {
    var project = Store.getProjectById(projectId);
    if (!project) {
      renderLayout('<div class="empty">Project not found.</div>');
      return;
    }

    var students = Store.listStudents();
    var meetings = Store.listMeetings(projectId);
    var actions = Store.listActionItems(projectId);
    var files = Store.listFiles(projectId);
    var summary = Store.getProjectSummary(projectId) || { openActionItems: 0, overdueCount: 0, meetingCount: 0 };
    var auditEvents = Store.listProjectAuditEvents(projectId).slice(0, 10);
    var tabs = ["overview", "activity", "meetings", "action-items", "files"];
    var currentTab = tabs.indexOf(activeTab) > -1 ? activeTab : "overview";
    var canEdit = state.user.role === "SUPERVISOR";
    var isStudentMember = state.user.role === "STUDENT" && project.studentIds.indexOf(state.user.id) > -1;
    var canManageMeetings = canEdit || isStudentMember;

    function tabButton(t, label) {
      return '<button class="tab ' + (currentTab === t ? "active" : "") + '" data-tab="' + t + '">' + label + "</button>";
    }

    var html = '<div class="row" style="margin-bottom:16px"><h1 class="page-title" style="margin:0">' + UI.escapeHtml(project.title) + '</h1></div>' +
      '<div class="card" style="margin-bottom:12px"><div class="tabs">' +
      tabButton("overview", "Overview") +
      tabButton("activity", "Activity") +
      tabButton("meetings", "Meetings") +
      tabButton("action-items", "Action Items") +
      tabButton("files", "Files") +
      '</div><div id="tab-body"></div></div>';

    renderLayout(html);
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var prefix = state.user.role === "SUPERVISOR" ? supervisorPrefix : studentPrefix;
        Router.go(prefix + "/projects/" + projectId + "?tab=" + btn.getAttribute("data-tab"));
      });
    });

    var tabBody = el("tab-body");

    if (currentTab === "overview") {
      tabBody.innerHTML = '<div class="split"><div class="card">' +
        '<h3 style="margin:0 0 10px">Project Info</h3>' +
        '<div class="kv"><div>Batch</div><div>' + UI.escapeHtml(project.batch) + '</div><div>Semester</div><div>' + UI.escapeHtml(project.semester) + '</div><div>Milestone</div><div>' + UI.formatDate(project.milestoneDate) + ' <span class="meta">(' + UI.escapeHtml(milestoneDeltaText(project.milestoneDate)) + ')</span></div><div>Lifecycle</div><div>' + lifecycleBadge(project.lifecycleStatus) + (project.healthSuggestedStatus ? ' <span class="badge at-risk">Suggested ' + UI.escapeHtml(project.healthSuggestedStatus) + '</span>' : "") + '</div><div>Open Action Items</div><div>' + summary.openActionItems + '</div><div>Overdue</div><div>' + summary.overdueCount + '</div></div>' +
        '<h4>Members</h4><div class="row wrap">' + project.studentIds.map(function (sid) {
          var s = byId(students, sid);
          return '<span class="badge on-track">' + UI.escapeHtml(s ? s.name : sid) + '</span>';
        }).join("") + '</div>' +
        (project.commsLink ? '<div style="margin-top:12px"><a class="btn primary" href="' + UI.escapeHtml(project.commsLink) + '" target="_blank" rel="noreferrer">Open Communication Channel</a></div>' : "") +
        (canEdit ? '<div style="margin-top:12px"><label class="meta">Transition Lifecycle</label><div class="row"><select id="project-status-next"><option>DRAFT</option><option>ACTIVE</option><option>AT_RISK</option><option>BEHIND</option><option>COMPLETED</option><option>ARCHIVED</option><option>CANCELLED</option></select><button class="btn small" id="project-status-apply">Apply</button></div></div>' : "") +
        '</div><div class="card"><h3 style="margin:0 0 10px">Integrations</h3>' +
        '<div class="row wrap" style="margin-bottom:8px">' +
        integrationBadge("GitHub", project.githubIntegration.status) +
        integrationBadge("Jira", project.jiraIntegration.status) +
        integrationBadge("Comms", project.commsIntegration.status) +
        '</div>' +
        '<div class="meta">GitHub URL: ' + UI.escapeHtml(project.githubUrl || "-") + '</div>' +
        '<div class="meta">Jira Key: ' + UI.escapeHtml(project.jiraProjectKey || "-") + '</div>' +
        '<div class="meta" style="margin-bottom:10px">Comms Link: ' + UI.escapeHtml(project.commsLink || "-") + '</div>' +
        (project.githubUrl ? '<a href="' + UI.escapeHtml(project.githubUrl) + '" target="_blank" class="btn small">Repo</a>' : "") +
        (project.jiraBoardLink ? ' <a href="' + UI.escapeHtml(project.jiraBoardLink) + '" target="_blank" class="btn small">Board</a>' : "") +
        (canEdit ? '<div style="margin-top:10px"><button class="btn" id="edit-connections">Connect Integrations</button></div>' : "") +
        '</div></div>' +
        '<div class="card" style="margin-top:12px"><h3 style="margin:0 0 10px">Activity Timeline</h3>' +
        (auditEvents.length ? '<div>' + auditEvents.map(function (ev) {
          var actor = Store.getUserById(ev.byUserId);
          return '<div style="border-bottom:1px solid var(--border);padding:8px 0"><strong>' + UI.escapeHtml(eventTypeLabel(ev.type)) + '</strong><div class="meta">' + UI.formatDateTime(ev.timestamp) + ' by ' + UI.escapeHtml(actor ? actor.name : "System") + '</div></div>';
        }).join("") + '</div>' : '<div class="empty">No activity events yet.</div>') +
        '</div>';

      if (canEdit) {
        el("project-status-next").value = project.lifecycleStatus;
        el("project-status-apply").addEventListener("click", function () {
          var next = el("project-status-next").value;
          var res = Store.applyProjectStatusTransition(project.id, next, state.user.id);
          if (!res.ok) {
            UI.toast(res.message || "Status transition failed.");
            return;
          }
          UI.toast("Project status updated.");
          renderProjectView(project.id, "overview");
        });

        el("edit-connections").addEventListener("click", function () {
          openIntegrationModal(project);
        });
      }
    }

    if (currentTab === "activity") {
      if (!project.githubUrl && !project.jiraProjectKey) {
        tabBody.innerHTML = '<div class="empty">No integrations configured yet. Add GitHub repo or Jira project key in project settings.</div>';
      } else {
        tabBody.innerHTML = '<div class="split"><div class="card"><h3 style="margin:0 0 10px">Commits Per Week</h3><canvas id="project-activity" width="620" height="220"></canvas></div><div class="card"><h3 style="margin:0 0 10px">Jira Summary</h3>' +
          '<div class="metric-label">To Do</div><div class="metric-value">' + project.analytics.jiraTodo + '</div><div class="metric-label">In Progress</div><div class="metric-value">' + project.analytics.jiraInProgress + '</div><div class="metric-label">Done</div><div class="metric-value">' + project.analytics.jiraDone + '</div></div></div>' +
          '<div class="card" style="margin-top:12px"><h3 style="margin:0 0 10px">Contributions by Student</h3><div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Commits</th><th>PRs</th></tr></thead><tbody>' +
          project.analytics.contributions.map(function (c) {
            var u = byId(students, c.userId);
            return '<tr><td>' + UI.escapeHtml(u ? u.name : c.userId) + '</td><td>' + c.commits + '</td><td>' + c.prs + '</td></tr>';
          }).join("") + '</tbody></table></div></div>';

        Charts.drawLineChart("project-activity", project.analytics.activityWeeks, ["W-5", "W-4", "W-3", "W-2", "W-1", "Now"]);
      }
    }

    if (currentTab === "meetings") {
      tabBody.innerHTML = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Meetings</h3>' + (canManageMeetings ? '<button class="btn primary" id="add-meeting">Add Meeting Minutes</button>' : "") + '</div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Date</th><th>Status</th><th>Summary</th><th>Actions</th></tr></thead><tbody>' +
        (meetings.map(function (m) {
          return '<tr><td>' + UI.escapeHtml(m.title) + '</td><td>' + UI.formatDate(m.date) + '</td><td>' + meetingStatusBadge(m.status) + '</td><td>' + UI.escapeHtml(m.summary.slice(0, 70)) + '</td><td><button class="btn small" data-view-meeting="' + m.id + '">View</button>' +
            ((m.status === "DRAFT" && canManageMeetings) ? ' <button class="btn small" data-submit-meeting="' + m.id + '">Submit</button>' : "") +
            ((m.status === "SUBMITTED" && canEdit) ? ' <button class="btn small" data-approve-meeting="' + m.id + '">Approve</button>' : "") +
            ((m.status === "APPROVED") ? ' <span class="notice"> Locked</span>' : "") +
            '</td></tr>';
        }).join("") || '<tr><td colspan="5"><div class="empty">No meetings yet.</div></td></tr>') +
        '</tbody></table></div>';

      if (canManageMeetings) {
        el("add-meeting").addEventListener("click", function () {
          openMeetingModal(project, students);
        });
      }
      document.querySelectorAll("[data-submit-meeting]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var res = Store.submitMeeting(project.id, btn.getAttribute("data-submit-meeting"), state.user.id);
          if (!res.ok) {
            UI.toast(res.message || "Unable to submit meeting.");
            return;
          }
          UI.toast("Meeting submitted.");
          renderProjectView(project.id, "meetings");
        });
      });
      document.querySelectorAll("[data-approve-meeting]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var res = Store.approveMeeting(project.id, btn.getAttribute("data-approve-meeting"), state.user.id);
          if (!res.ok) {
            UI.toast(res.message || "Unable to approve meeting.");
            return;
          }
          UI.toast("Meeting approved.");
          renderProjectView(project.id, "meetings");
        });
      });
      document.querySelectorAll("[data-view-meeting]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var meeting = Store.getMeetingById(btn.getAttribute("data-view-meeting"));
          if (!meeting) {
            return;
          }
          var aItems = Store.listActionItems(project.id).filter(function (a) { return a.meetingId === meeting.id; });
          UI.openModal("Meeting Detail", '<p><strong>' + UI.escapeHtml(meeting.title) + '</strong> - ' + UI.formatDate(meeting.date) + '</p><p>' + meetingStatusBadge(meeting.status) + '</p><p>' + UI.escapeHtml(meeting.summary) + '</p><p><strong>Decisions:</strong> ' + UI.escapeHtml(meeting.decisions) + '</p><h4>Action Items</h4><ul>' + aItems.map(function (a) {
            var owner = byId(students, a.assigneeId || a.ownerId);
            return '<li>' + UI.escapeHtml(a.description) + ' (' + UI.escapeHtml(owner ? owner.name : a.assigneeId || a.ownerId) + ") - " + UI.escapeHtml(a.priority) + '</li>';
          }).join("") + "</ul>", '');
        });
      });
    }

    if (currentTab === "action-items") {
      tabBody.innerHTML = '<div class="table-wrap"><table class="table action-items-table"><thead><tr><th>Description</th><th>Assignee</th><th>Due</th><th>Status</th><th>Priority</th><th>Meeting</th><th>Jira</th><th>Comment / Evidence</th><th>Actions</th></tr></thead><tbody>' +
        (actions.map(function (a) {
          var canEditAction = Store.canEditActionItem(state.user, a, project);
          var lockFields = a.fieldsLocked;
          var fieldDisabled = (!canEditAction || lockFields) ? "disabled" : "";
          var statusDisabled = !canEditAction ? "disabled" : "";
          return '<tr>' +
            '<td><div class="action-desc">' + UI.escapeHtml(a.description) + '</div></td>' +
            '<td><select class="action-control compact" data-action-assignee="' + a.id + '" ' + fieldDisabled + '>' + students.filter(function (s) {
              return project.studentIds.indexOf(s.id) > -1;
            }).map(function (s) {
              var selected = (s.id === (a.assigneeId || a.ownerId)) ? "selected" : "";
              return '<option value="' + s.id + '" ' + selected + '>' + UI.escapeHtml(s.name) + '</option>';
            }).join("") + "</select></td>" +
            '<td><div class="action-due-wrap"><input class="action-control compact" data-action-due="' + a.id + '" type="date" value="' + UI.escapeHtml(a.dueDate) + '" ' + fieldDisabled + '/>' + (a.isOverdue ? ' <span class="badge behind">Overdue</span>' : "") + '</div></td>' +
            '<td><select class="action-control compact" data-action-status="' + a.id + '" ' + statusDisabled + '><option ' + (a.status === "Todo" ? "selected" : "") + '>Todo</option><option ' + (a.status === "In Progress" ? "selected" : "") + '>In Progress</option><option ' + (a.status === "Done" ? "selected" : "") + '>Done</option></select></td>' +
            '<td><select class="action-control compact" data-action-priority="' + a.id + '" ' + fieldDisabled + '><option value="LOW" ' + (a.priority === "LOW" ? "selected" : "") + '>LOW</option><option value="MEDIUM" ' + (a.priority === "MEDIUM" ? "selected" : "") + '>MEDIUM</option><option value="HIGH" ' + (a.priority === "HIGH" ? "selected" : "") + '>HIGH</option></select></td>' +
            '<td>' + UI.escapeHtml((meetings.find(function (m) { return m.id === a.meetingId; }) || {}).title || "-") + '</td>' +
            '<td>' + (a.jira ? '<a href="' + UI.escapeHtml(a.jira.url) + '" target="_blank">' + UI.escapeHtml(a.jira.key) + '</a>' : "-") + '</td>' +
            '<td><div class="action-notes"><textarea class="action-control action-comment" data-action-comment="' + a.id + '" rows="2" placeholder="Add comment"></textarea><input class="action-control action-evidence" data-action-evidence="' + a.id + '" placeholder="Evidence link" value="' + UI.escapeHtml(a.evidenceLink || "") + '" /></div></td>' +
            '<td>' +
            (lockFields ? '<div class="notice action-locked">Locked fields</div>' : "") +
            (canEditAction
              ? '<div class="action-btn-stack">' +
              (lockFields ? "" : '<button class="btn small" data-save-action="' + a.id + '">Save Fields</button>') +
              '<button class="btn small" data-update-action-status="' + a.id + '">Update Status</button>' +
              '<button class="btn small" data-create-jira="' + a.id + '">Create Jira Task</button>' +
              '<button class="btn small" data-link-jira="' + a.id + '">Link Jira</button>' +
              '</div>'
              : '<span class="notice">Read-only</span>') +
            '</td>' +
            "</tr>";
        }).join("") || '<tr><td colspan="9"><div class="empty">No action items yet.</div></td></tr>') +
        '</tbody></table></div>';

      document.querySelectorAll("[data-save-action]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var actionId = btn.getAttribute("data-save-action");
          var assignee = document.querySelector('[data-action-assignee="' + actionId + '"]');
          var due = document.querySelector('[data-action-due="' + actionId + '"]');
          var priority = document.querySelector('[data-action-priority="' + actionId + '"]');
          var comment = document.querySelector('[data-action-comment="' + actionId + '"]');
          var evidence = document.querySelector('[data-action-evidence="' + actionId + '"]');
          var res = Store.updateActionItem(actionId, {
            assigneeId: assignee ? assignee.value : null,
            dueDate: due ? due.value : null,
            priority: priority ? priority.value : null,
            comment: comment ? comment.value.trim() : "",
            evidenceLink: evidence ? evidence.value.trim() : ""
          }, state.user.id);
          if (!res.ok) {
            UI.toast(res.message || "Unable to update action item.");
            return;
          }
          UI.toast("Action item updated.");
          renderProjectView(projectId, "action-items");
        });
      });

      document.querySelectorAll("[data-update-action-status]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var actionId = btn.getAttribute("data-update-action-status");
          var select = document.querySelector('[data-action-status="' + actionId + '"]');
          var comment = document.querySelector('[data-action-comment="' + actionId + '"]');
          var evidence = document.querySelector('[data-action-evidence="' + actionId + '"]');
          var res = Store.updateActionItemStatus(actionId, select ? select.value : "Todo", state.user.id, {
            comment: comment ? comment.value.trim() : "",
            evidenceLink: evidence ? evidence.value.trim() : ""
          });
          if (!res.ok) {
            UI.toast(res.message || "Unable to update status.");
            return;
          }
          UI.toast("Action item status updated.");
          renderProjectView(projectId, "action-items");
        });
      });

      document.querySelectorAll("[data-create-jira]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!project.jiraProjectKey) {
            UI.toast("Jira not configured for this project. Add project key.");
            return;
          }
          var updated = Store.createMockJiraForAction(btn.getAttribute("data-create-jira"), project.id, state.user.id);
          if (updated.ok) {
            UI.toast("Jira task created: " + updated.item.jira.key);
            renderProjectView(projectId, "action-items");
          } else {
            UI.toast(updated.message || "Unable to create Jira issue.");
          }
        });
      });

      document.querySelectorAll("[data-link-jira]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          openLinkJiraModal(btn.getAttribute("data-link-jira"), projectId);
        });
      });
    }

    if (currentTab === "files") {
      tabBody.innerHTML = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Project Files</h3>' +
        '<div>' + (canEdit ? '<input id="file-upload" type="file" />' : '<span class="notice">Read-only in student view</span>') + '</div></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Filename</th><th>Uploader</th><th>Uploaded At</th><th>Size</th><th>Type</th><th>Action</th></tr></thead><tbody>' +
        (files.map(function (f) {
          var uploader = Store.getUserById(f.uploaderId);
          return '<tr><td>' + UI.escapeHtml(f.name) + '</td><td>' + UI.escapeHtml(uploader ? uploader.name : f.uploaderId) + '</td><td>' + UI.formatDateTime(f.uploadedAt) + '</td><td>' + UI.formatBytes(f.size) + '</td><td>' + UI.escapeHtml(f.type || "-") + '</td><td><button class="btn small" data-download-file="' + f.id + '">Download</button></td></tr>';
        }).join("") || '<tr><td colspan="6"><div class="empty">No files yet.</div></td></tr>') +
        '</tbody></table></div>';

      var upload = el("file-upload");
      if (upload) {
        upload.addEventListener("change", function () {
          if (!upload.files || !upload.files[0]) {
            return;
          }
          var file = upload.files[0];
          Store.addFile(projectId, {
            name: file.name,
            size: file.size,
            type: file.type,
            uploaderId: state.user.id
          });
          UI.toast("File uploaded (metadata stored)");
          renderProjectView(projectId, "files");
        });
      }

      document.querySelectorAll("[data-download-file]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          UI.toast("Download simulated");
        });
      });
    }
  }

  function openIntegrationModal(project) {
    var body = '<div class="form-grid">' +
      '<div class="full"><label>GitHub URL</label><input id="m-gh" value="' + UI.escapeHtml(project.githubUrl) + '"/></div>' +
      '<div><label>Jira Project Key</label><input id="m-jira" value="' + UI.escapeHtml(project.jiraProjectKey) + '"/></div>' +
      '<div><label>Jira Board Link</label><input id="m-jira-board" value="' + UI.escapeHtml(project.jiraBoardLink) + '"/></div>' +
      '<div class="full"><label>Communication Link</label><input id="m-comms" value="' + UI.escapeHtml(project.commsLink) + '"/></div>' +
      "</div>";
    UI.openModal("Project Integrations", body, '<button class="btn" id="save-int">Save</button>');
    el("save-int").addEventListener("click", function () {
      var result = Store.updateProjectIntegrations(project.id, {
        githubUrl: el("m-gh").value.trim(),
        jiraProjectKey: el("m-jira").value.trim().toUpperCase(),
        jiraBoardLink: el("m-jira-board").value.trim(),
        commsLink: el("m-comms").value.trim()
      }, state.user.id);
      if (!result.ok) {
        UI.toast(result.message || "Unable to update integrations.");
        return;
      }
      UI.closeModal();
      UI.toast("Integrations updated");
      renderProjectView(project.id, "overview");
    });
  }

  function openMeetingModal(project, students) {
    var actionsMarkup = '<div id="action-list"></div><button class="btn small" id="add-action-row">Add Action Item</button>';

    UI.openModal(
      "Add Meeting Minutes",
      '<div class="form-grid">' +
      '<div class="full"><label>Meeting Title</label><input id="meet-title" /></div>' +
      '<div><label>Date</label><input id="meet-date" type="date" /></div>' +
      '<div><label></label><div class="notice">Add summary and decisions below.</div></div>' +
      '<div class="full"><label>Summary</label><textarea id="meet-summary" rows="3"></textarea></div>' +
      '<div class="full"><label>Decisions</label><textarea id="meet-decisions" rows="2"></textarea></div>' +
      '<div class="full"><h4>Action Items</h4>' + actionsMarkup + '</div></div>',
      '<button class="btn primary" id="save-meeting">Save Meeting</button>'
    );

    function addActionRow() {
      var idx = document.querySelectorAll(".action-row").length;
      var jiraDisabled = project.jiraProjectKey ? "" : "disabled";
      var hint = project.jiraProjectKey ? "" : '<div class="notice">Jira link unavailable (project key missing)</div>';
      var row = document.createElement("div");
      row.className = "action-row";
      row.innerHTML = '<div class="form-grid">' +
        '<div class="full"><label>Description</label><input data-a-desc="' + idx + '" /></div>' +
        '<div><label>Assignee</label><select data-a-owner="' + idx + '">' + students.filter(function (s) { return project.studentIds.indexOf(s.id) > -1; }).map(function (s) { return '<option value="' + s.id + '">' + UI.escapeHtml(s.name) + '</option>'; }).join("") + '</select></div>' +
        '<div><label>Due Date</label><input data-a-due="' + idx + '" type="date" /></div>' +
        '<div><label>Priority</label><select data-a-priority="' + idx + '"><option value="HIGH">HIGH</option><option value="MEDIUM" selected>MEDIUM</option><option value="LOW">LOW</option></select></div>' +
        '<div class="full"><label><input type="checkbox" data-a-jira="' + idx + '" ' + jiraDisabled + '/> Link to Jira now</label>' + hint + '</div>' +
        "</div>";
      el("action-list").appendChild(row);
    }

    el("add-action-row").addEventListener("click", addActionRow);
    addActionRow();

    el("save-meeting").addEventListener("click", function () {
      var title = el("meet-title").value.trim();
      var date = el("meet-date").value;
      var summary = el("meet-summary").value.trim();
      var decisions = el("meet-decisions").value.trim();

      if (!title || !date || !summary) {
        UI.toast("Please fill meeting title, date, and summary");
        return;
      }

      var rows = Array.prototype.slice.call(document.querySelectorAll(".action-row"));
      var actionItems = rows.map(function (_, idx) {
        var desc = document.querySelector('[data-a-desc="' + idx + '"]');
        if (!desc || !desc.value.trim()) {
          return null;
        }
        var owner = document.querySelector('[data-a-owner="' + idx + '"]');
        var due = document.querySelector('[data-a-due="' + idx + '"]');
        var pri = document.querySelector('[data-a-priority="' + idx + '"]');
        var jiraFlag = document.querySelector('[data-a-jira="' + idx + '"]');
        var jira = null;
        if (jiraFlag && jiraFlag.checked && project.jiraProjectKey) {
          var tmp = project.jiraProjectKey + "-" + Math.floor(100 + Math.random() * 900);
          jira = { key: tmp, url: "https://jira.example.com/browse/" + tmp };
        }
        return {
          description: desc.value.trim(),
          assigneeId: owner ? owner.value : project.studentIds[0],
          dueDate: due && due.value ? due.value : "",
          priority: pri ? pri.value : "MEDIUM",
          jira: jira
        };
      }).filter(Boolean);

      if (actionItems.some(function (item) { return !item.dueDate; })) {
        UI.toast("Each action item requires a due date.");
        return;
      }

      var result = Store.createMeeting(project.id, {
        title: title,
        date: date,
        summary: summary,
        decisions: decisions,
        actionItems: actionItems
      }, state.user.id);
      if (!result.ok) {
        UI.toast(result.message || "Unable to save meeting.");
        return;
      }
      UI.closeModal();
      UI.toast("Meeting saved as draft");
      renderProjectView(project.id, "meetings");
    });
  }

  function openLinkJiraModal(actionId, projectId) {
    UI.openModal("Link Existing Jira", '<div class="form-grid"><div><label>Issue Key</label><input id="jira-key" placeholder="ABC-123"/></div><div><label>Issue URL</label><input id="jira-url" placeholder="https://jira.example.com/browse/ABC-123"/></div></div>', '<button class="btn primary" id="jira-link-save">Link</button>');
    el("jira-link-save").addEventListener("click", function () {
      var key = el("jira-key").value.trim().toUpperCase();
      var url = el("jira-url").value.trim();
      if (!key || !url) {
        UI.toast("Please enter issue key and URL");
        return;
      }
      var result = Store.linkActionItemJira(actionId, { key: key, url: url }, state.user.id);
      if (!result.ok) {
        UI.toast(result.message || "Unable to link Jira issue.");
        return;
      }
      UI.closeModal();
      UI.toast("Jira link saved");
      renderProjectView(projectId, "action-items");
    });
  }

  function renderStudentHome() {
    Router.go("/projects");
  }

  function renderFinalizePage() {
    var modules = ["AUTH_SESSION", "ROLES_PERMISSIONS", "PROJECT_LIFECYCLE", "MEETINGS", "ACTION_ITEMS", "DASHBOARD_KPIS", "FILES", "INTEGRATIONS", "REPORTING_EXPORT"];
    var statuses = ["OPEN", "DISCUSSING", "DECIDED", "DEFERRED"];
    var isSupervisor = state.user && state.user.role === "SUPERVISOR";
    var viewState = {
      query: "",
      module: "",
      priority: "",
      statusFilters: ["OPEN", "DISCUSSING", "DECIDED", "DEFERRED"]
    };

    function groupedCounts(items, module) {
      var rows = items.filter(function (x) { return x.module === module; });
      return {
        total: rows.length,
        open: rows.filter(function (x) { return x.status === "OPEN"; }).length,
        discussing: rows.filter(function (x) { return x.status === "DISCUSSING"; }).length,
        decided: rows.filter(function (x) { return x.status === "DECIDED"; }).length,
        deferred: rows.filter(function (x) { return x.status === "DEFERRED"; }).length
      };
    }

    function matchesFilter(item) {
      var q = viewState.query.toLowerCase();
      var inSearch = !q || item.title.toLowerCase().indexOf(q) > -1 || item.businessIntent.toLowerCase().indexOf(q) > -1 || item.currentImplementation.toLowerCase().indexOf(q) > -1;
      var inModule = !viewState.module || item.module === viewState.module;
      var inPriority = !viewState.priority || item.priority === viewState.priority;
      var inStatus = viewState.statusFilters.indexOf(item.status) > -1;
      return inSearch && inModule && inPriority && inStatus;
    }

    function renderItemDetail(item) {
      var lastBy = item.updatedByUserId ? Store.getUserById(item.updatedByUserId) : null;
      var readOnly = !isSupervisor;
      var altList = item.alternatives.length ? "<ul>" + item.alternatives.map(function (a) { return "<li>" + UI.escapeHtml(a) + "</li>"; }).join("") + "</ul>" : '<div class="meta">No alternatives listed.</div>';
      var statusField = readOnly
        ? '<div><label>Status</label><div class="readonly-field">' + item.status + "</div></div>"
        : '<div><label>Status</label><select data-fin-status="' + item.id + '">' + statuses.map(function (s) { return '<option ' + (item.status === s ? "selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div>";
      var priorityField = readOnly
        ? '<div><label>Priority</label><div class="readonly-field">' + item.priority + "</div></div>"
        : '<div><label>Priority</label><select data-fin-priority="' + item.id + '"><option ' + (item.priority === "MUST" ? "selected" : "") + '>MUST</option><option ' + (item.priority === "SHOULD" ? "selected" : "") + '>SHOULD</option><option ' + (item.priority === "COULD" ? "selected" : "") + '>COULD</option></select></div>';
      var impactField = readOnly
        ? '<div><label>Impact</label><div class="readonly-field">' + item.impact + "</div></div>"
        : '<div><label>Impact</label><select data-fin-impact="' + item.id + '"><option ' + (item.impact === "HIGH" ? "selected" : "") + '>HIGH</option><option ' + (item.impact === "MEDIUM" ? "selected" : "") + '>MEDIUM</option><option ' + (item.impact === "LOW" ? "selected" : "") + '>LOW</option></select></div>';
      var ownerField = readOnly
        ? '<div><label>Owner</label><div class="readonly-field">' + item.owner + "</div></div>"
        : '<div><label>Owner</label><select data-fin-owner="' + item.id + '"><option ' + (item.owner === "CLIENT" ? "selected" : "") + '>CLIENT</option><option ' + (item.owner === "TEAM" ? "selected" : "") + '>TEAM</option></select></div>';
      return '<div class="finalize-detail finalize-modal-detail">' +
        '<div class="finalize-detail-grid">' +
        '<div><h4>Business intent</h4><p>' + UI.escapeHtml(item.businessIntent || "-") + '</p></div>' +
        '<div><h4>Current implementation</h4><p>' + UI.escapeHtml(item.currentImplementation || "-") + '</p></div>' +
        '<div><h4>Risk prevented</h4><p>' + UI.escapeHtml(item.riskPrevented || "-") + '</p></div>' +
        '<div><h4>Alternatives</h4>' + altList + '</div>' +
        '</div>' +
        '<div class="finalize-decision-row">' +
        '<div class="form-grid">' +
        statusField +
        priorityField +
        impactField +
        ownerField +
        '<div class="full"><label>Client decision</label><textarea rows="3" data-fin-decision="' + item.id + '" ' + (readOnly ? "readonly" : "") + ' placeholder="Document the agreed decision...">' + UI.escapeHtml(item.clientDecision || "") + "</textarea></div>" +
        '</div>' +
        (readOnly ? '<div class="notice">Read-only for student role.</div>' : "") +
        '</div>' +
        '<div class="meta finalize-meta">Last updated: ' + UI.formatDateTime(item.updatedAt) + (lastBy ? " by " + UI.escapeHtml(lastBy.name) : "") + "</div>" +
        '</div>';
    }

    function statusTone(status) {
      if (status === "DECIDED") {
        return "on-track";
      }
      if (status === "DEFERRED") {
        return "behind";
      }
      return "at-risk";
    }

    function attentionMeta(item) {
      if (item.status === "OPEN" && (item.priority === "MUST" || item.impact === "HIGH")) {
        return { label: "Needs decision", tone: "behind" };
      }
      if (item.status === "DISCUSSING" && item.impact === "HIGH") {
        return { label: "High-impact pending", tone: "at-risk" };
      }
      if (item.status === "DEFERRED") {
        return { label: "Deferred follow-up", tone: "behind" };
      }
      return { label: "Tracked", tone: "info" };
    }

    function openFinalizeItemModal(itemId) {
      var item = Store.getFinalizeItems().find(function (x) { return x.id === itemId; });
      if (!item) {
        UI.toast("Item not found.");
        return;
      }

      var readOnly = !isSupervisor;
      var footer = readOnly
        ? ""
        : '<button class="btn small ghost" id="fin-modal-delete">Delete</button><button class="btn small" id="fin-modal-save">Save</button><button class="btn small primary" id="fin-modal-decide">Mark Decided</button>';

      UI.openModal("Checklist Detail", renderItemDetail(item), footer);

      var escHandler = function (event) {
        if (event.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          UI.closeModal();
        }
      };
      document.addEventListener("keydown", escHandler);

      var closeBtn = el("modal-x");
      if (closeBtn) {
        closeBtn.addEventListener("click", function () {
          document.removeEventListener("keydown", escHandler);
        });
      }
      var closeTarget = el("modal-close-target");
      if (closeTarget) {
        closeTarget.addEventListener("click", function (event) {
          if (event.target.id === "modal-close-target") {
            document.removeEventListener("keydown", escHandler);
          }
        });
      }

      if (!readOnly) {
        var saveBtn = el("fin-modal-save");
        if (saveBtn) {
          saveBtn.addEventListener("click", function () {
            var statusSel = document.querySelector('[data-fin-status="' + item.id + '"]');
            var priSel = document.querySelector('[data-fin-priority="' + item.id + '"]');
            var impactSel = document.querySelector('[data-fin-impact="' + item.id + '"]');
            var ownerSel = document.querySelector('[data-fin-owner="' + item.id + '"]');
            var decision = document.querySelector('[data-fin-decision="' + item.id + '"]');
            var result = Store.updateFinalizeItem(item.id, {
              status: statusSel ? statusSel.value : undefined,
              priority: priSel ? priSel.value : undefined,
              impact: impactSel ? impactSel.value : undefined,
              owner: ownerSel ? ownerSel.value : undefined,
              clientDecision: decision ? decision.value.trim() : ""
            }, state.user);
            if (!result.ok) {
              UI.toast(result.message || "Unable to save item.");
              return;
            }
            document.removeEventListener("keydown", escHandler);
            UI.closeModal();
            UI.toast("Finalize item updated.");
            renderPage();
          });
        }

        var decideBtn = el("fin-modal-decide");
        if (decideBtn) {
          decideBtn.addEventListener("click", function () {
            var decision = document.querySelector('[data-fin-decision="' + item.id + '"]');
            var result = Store.updateFinalizeItem(item.id, {
              status: "DECIDED",
              clientDecision: decision ? decision.value.trim() : ""
            }, state.user);
            if (!result.ok) {
              UI.toast(result.message || "Unable to mark decided.");
              return;
            }
            document.removeEventListener("keydown", escHandler);
            UI.closeModal();
            UI.toast("Marked as DECIDED.");
            renderPage();
          });
        }

        var delBtn = el("fin-modal-delete");
        if (delBtn) {
          delBtn.addEventListener("click", function () {
            var res = Store.deleteFinalizeItem(item.id, state.user);
            if (!res.ok) {
              UI.toast(res.message || "Unable to delete item.");
              return;
            }
            document.removeEventListener("keydown", escHandler);
            UI.closeModal();
            UI.toast("Finalize item deleted.");
            renderPage();
          });
        }
      }
    }

    function buildExport(format, filtered) {
      return Store.exportFinalizeItems(format, filtered);
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return Promise.reject(new Error("Clipboard unavailable"));
    }

    function openAddModal() {
      UI.openModal(
        "Add Finalize Item",
        '<div class="form-grid">' +
        '<div><label>Module</label><select id="fin-new-module">' + modules.map(function (m) { return "<option>" + m + "</option>"; }).join("") + '</select></div>' +
        '<div><label>Title</label><input id="fin-new-title" placeholder="Short requirement title" /></div>' +
        '<div class="full"><label>Business intent</label><textarea id="fin-new-intent" rows="2"></textarea></div>' +
        '<div class="full"><label>Current implementation</label><textarea id="fin-new-current" rows="2"></textarea></div>' +
        '<div class="full"><label>Risk prevented</label><textarea id="fin-new-risk" rows="2"></textarea></div>' +
        '<div class="full"><label>Alternatives (comma-separated)</label><input id="fin-new-alt" placeholder="Alternative A, Alternative B" /></div>' +
        '<div><label>Priority</label><select id="fin-new-priority"><option>MUST</option><option>SHOULD</option><option>COULD</option></select></div>' +
        '<div><label>Impact</label><select id="fin-new-impact"><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></div>' +
        '</div>',
        '<button class="btn primary" id="fin-new-save">Add Item</button>'
      );
      el("fin-new-save").addEventListener("click", function () {
        var payload = {
          module: el("fin-new-module").value,
          title: el("fin-new-title").value.trim(),
          businessIntent: el("fin-new-intent").value.trim(),
          currentImplementation: el("fin-new-current").value.trim(),
          riskPrevented: el("fin-new-risk").value.trim(),
          alternatives: el("fin-new-alt").value.split(",").map(function (x) { return x.trim(); }).filter(Boolean),
          priority: el("fin-new-priority").value,
          impact: el("fin-new-impact").value
        };
        var result = Store.addFinalizeItem(payload, state.user);
        if (!result.ok) {
          UI.toast(result.message || "Unable to add item.");
          return;
        }
        UI.closeModal();
        UI.toast("Finalize item added.");
        renderPage();
      });
    }

    function renderPage() {
      var allItems = Store.getFinalizeItems();
      var stats = Store.getFinalizeStats();
      var filtered = allItems.filter(matchesFilter);
      var hasAnyItems = allItems.length > 0;
      var groupedHtml = modules.map(function (module) {
        var rows = filtered.filter(function (item) { return item.module === module; });
        if (!rows.length) {
          return "";
        }
        var c = groupedCounts(filtered, module);
        return '<details class="finalize-group" open><summary><span class="finalize-group-title">' + module.replace(/_/g, " ") + '</span><span class="finalize-group-counts"><span class="badge info">Open ' + c.open + '</span><span class="badge at-risk">Discussing ' + c.discussing + '</span><span class="badge on-track">Decided ' + c.decided + '</span><span class="badge behind">Deferred ' + c.deferred + "</span></span></summary><div class=\"finalize-cards\">" +
          rows.map(function (item) {
            var tone = statusTone(item.status);
            var attention = attentionMeta(item);
            return '<article class="finalize-card tone-' + tone + '" data-fin-open="' + item.id + '" tabindex="0">' +
              '<div class="row wrap" style="justify-content:space-between"><h4>' + UI.escapeHtml(item.title) + '</h4><div class="row wrap"><span class="badge ' + tone + '">' + item.status + '</span><span class="badge info">' + item.priority + "/" + item.impact + '</span><span class="badge ' + attention.tone + '">' + attention.label + "</span></div></div>" +
              '<p class="meta finalize-preview">' + UI.escapeHtml(item.currentImplementation || item.businessIntent || "No summary available.") + '</p>' +
              '<div class="row wrap finalize-card-footer"><span class="meta">Owner: ' + UI.escapeHtml(item.owner) + '</span><button class="btn small ghost" type="button">Review</button></div>' +
              '</article>';
          }).join("") + "</div></details>";
      }).join("");

      renderLayout(
        '<section class="finalize-shell">' +
        '<div class="finalize-header card"><div><h1 class="page-title" style="margin-bottom:8px">BA Checklist</h1><p class="meta">Client clarifications to confirm before locking scope</p></div><div class="row wrap finalize-header-actions"><a class="btn small ghost" href="/">Home</a><select id="fin-export-format" class="finalize-select"><option value="json">Export JSON</option><option value="text">Export Text</option></select><button class="btn small" id="fin-export-btn">Export</button><button class="btn small" id="fin-copy-btn">Copy</button>' + (isSupervisor ? '<button class="btn small primary" id="fin-add-btn">Add Item</button>' : "") + '</div></div>' +
        '<div class="finalize-stats row wrap">' +
        '<span class="badge info">Total ' + stats.total + '</span>' +
        '<span class="badge at-risk">Open ' + stats.openCount + '</span>' +
        '<span class="badge at-risk">Discussing ' + stats.discussingCount + '</span>' +
        '<span class="badge on-track">Decided ' + stats.decidedCount + '</span>' +
        '<span class="badge behind">Deferred ' + stats.deferredCount + '</span>' +
        '</div>' +
        '<div class="finalize-controls card"><div class="row wrap"><input id="fin-search" placeholder="Search title, intent, or current implementation" value="' + UI.escapeHtml(viewState.query) + '"/><select id="fin-module" class="finalize-select"><option value="">All Modules</option>' + modules.map(function (m) { return '<option value="' + m + '" ' + (viewState.module === m ? "selected" : "") + ">" + m + "</option>"; }).join("") + '</select><select id="fin-priority" class="finalize-select"><option value="">All Priority</option><option value="MUST" ' + (viewState.priority === "MUST" ? "selected" : "") + '>MUST</option><option value="SHOULD" ' + (viewState.priority === "SHOULD" ? "selected" : "") + '>SHOULD</option><option value="COULD" ' + (viewState.priority === "COULD" ? "selected" : "") + '>COULD</option></select><button class="btn small ghost" id="fin-reset">Reset filters</button></div><div class="row wrap finalize-status-chips">' + statuses.map(function (s) {
          var active = viewState.statusFilters.indexOf(s) > -1;
          return '<button class="btn small ' + (active ? "primary" : "ghost") + '" data-fin-status-filter="' + s + '">' + s + "</button>";
        }).join("") + '</div></div>' +
        (hasAnyItems
          ? (groupedHtml || '<div class="card"><div class="empty">No matching items. <button class="btn small" id="fin-clear-empty">Clear filters</button></div></div>')
          : '<div class="card"><div class="empty">No finalize items available.' + (isSupervisor ? ' <button class="btn small" id="fin-seed-defaults">Seed Defaults</button>' : "") + '</div></div>') +
        '</section>'
      );

      var search = el("fin-search");
      if (search) {
        search.addEventListener("input", function () {
          viewState.query = search.value.trim();
          renderPage();
        });
      }
      var mod = el("fin-module");
      if (mod) {
        mod.addEventListener("change", function () {
          viewState.module = mod.value;
          renderPage();
        });
      }
      var pr = el("fin-priority");
      if (pr) {
        pr.addEventListener("change", function () {
          viewState.priority = pr.value;
          renderPage();
        });
      }

      var reset = el("fin-reset");
      if (reset) {
        reset.addEventListener("click", function () {
          viewState.query = "";
          viewState.module = "";
          viewState.priority = "";
          viewState.statusFilters = statuses.slice();
          renderPage();
        });
      }
      var clearEmpty = el("fin-clear-empty");
      if (clearEmpty) {
        clearEmpty.addEventListener("click", function () {
          viewState.query = "";
          viewState.module = "";
          viewState.priority = "";
          viewState.statusFilters = statuses.slice();
          renderPage();
        });
      }

      document.querySelectorAll("[data-fin-status-filter]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var key = btn.getAttribute("data-fin-status-filter");
          var idx = viewState.statusFilters.indexOf(key);
          if (idx > -1) {
            if (viewState.statusFilters.length > 1) {
              viewState.statusFilters.splice(idx, 1);
            }
          } else {
            viewState.statusFilters.push(key);
          }
          renderPage();
        });
      });

      document.querySelectorAll("[data-fin-open]").forEach(function (card) {
        var open = function () {
          var id = card.getAttribute("data-fin-open");
          openFinalizeItemModal(id);
        };
        card.addEventListener("click", function (event) {
          if (event.target.closest("textarea,select,input,button,a")) {
            return;
          }
          open();
        });
        card.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        });
      });

      if (isSupervisor) {
        var addBtn = el("fin-add-btn");
        if (addBtn) {
          addBtn.addEventListener("click", openAddModal);
        }
        var seedBtn = el("fin-seed-defaults");
        if (seedBtn) {
          seedBtn.addEventListener("click", function () {
            var result = Store.resetFinalizeItems(state.user);
            if (!result.ok) {
              UI.toast(result.message || "Unable to reset defaults.");
              return;
            }
            UI.toast("Finalize defaults restored.");
            renderPage();
          });
        }
      }

      var exportBtn = el("fin-export-btn");
      if (exportBtn) {
        exportBtn.addEventListener("click", function () {
          var fmt = el("fin-export-format").value;
          var content = buildExport(fmt, filtered);
          var ext = fmt === "text" ? "txt" : "json";
          var blob = new Blob([content], { type: fmt === "text" ? "text/plain" : "application/json" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "finalize-requirements." + ext;
          a.click();
          URL.revokeObjectURL(a.href);
          UI.toast("Export generated.");
        });
      }
      var copyBtn = el("fin-copy-btn");
      if (copyBtn) {
        copyBtn.addEventListener("click", function () {
          var fmt = el("fin-export-format").value;
          var content = buildExport(fmt, filtered);
          copyText(content).then(function () {
            UI.toast("Copied");
          }).catch(function () {
            UI.toast("Clipboard not available");
          });
        });
      }
    }

    renderPage();
  }

  function renderCurrentRoute() {
    if (!state.route) {
      return;
    }

    if (!enforceRouteGuards(state.route)) {
      return;
    }

    if (state.route.path === "/") {
      renderLanding();
      return;
    }

    if (state.route.path === "/login") {
      renderLogin();
      return;
    }

    if (state.route.path === "/register") {
      renderRegister();
      return;
    }

    if (state.route.path === "/supervisor/dashboard") {
      renderDashboard();
      return;
    }

    if (state.route.path === "/supervisor/projects" || state.route.path === "/student/projects") {
      renderProjectsList();
      return;
    }

    if (state.route.path === "/supervisor/projects/new") {
      renderProjectWizard();
      return;
    }

    if (state.route.path === "/supervisor/projects/:id" || state.route.path === "/student/projects/:id") {
      renderProjectView(state.route.params.id, state.route.query.tab);
      return;
    }

    if (state.route.path === "/BAchecklist") {
      renderFinalizePage();
      return;
    }

    Router.go(state.user && state.user.role === "STUDENT" ? "/student" : "/");
  }

  function boot() {
    Store.init();
    Router.onChange(function (route) {
      state.route = route;
      renderCurrentRoute();
    });
    Router.start();
  }

  window.App = {
    boot: boot
  };

  boot();
})();
