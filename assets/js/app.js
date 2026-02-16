(function () {
  var state = {
    user: null,
    route: null,
    search: ""
  };

  var supervisorOnly = ["/dashboard", "/projects", "/projects/new"];

  function el(id) {
    return document.getElementById(id);
  }

  function title(text) {
    return '<h1 class="page-title">' + UI.escapeHtml(text) + "</h1>";
  }

  function byId(arr, id) {
    return arr.find(function (x) { return x.id === id; });
  }

  function sidebarHtml() {
    if (!state.user) {
      return "";
    }

    var items = state.user.role === "SUPERVISOR"
      ? [
        { key: "dashboard", label: "Dashboard", hash: "#/dashboard" },
        { key: "projects", label: "Projects", hash: "#/projects" },
        { key: "new", label: "Create Project", hash: "#/projects/new" }
      ]
      : [
        { key: "student", label: "Student Home", hash: "#/student" },
        { key: "projects", label: "My Projects", hash: "#/projects" }
      ];

    var activePath = state.route ? state.route.path : "";

    return '<div class="brand">SuperviseSuite</div><div class="nav-group">' +
      items.map(function (item) {
        var isActive = activePath.indexOf(item.key) !== -1 || (activePath === "/projects/:id" && item.key === "projects");
        return '<button class="nav-item ' + (isActive ? "active" : "") + '" data-nav="' + item.hash + '">' + UI.escapeHtml(item.label) + "</button>";
      }).join("") +
      "</div>";
  }

  function topbarHtml() {
    if (!state.user) {
      return "";
    }

    return '<div class="search-wrap"><input class="search-input" id="global-search" placeholder="Search projects or students" value="' + UI.escapeHtml(state.search) + '"/></div>' +
      '<div class="topbar-right"><span class="meta">' + UI.escapeHtml(state.user.role) + '</span><strong>' + UI.escapeHtml(state.user.name) + '</strong><button class="btn small" id="logout-btn">Logout</button></div>';
  }

  function enforceRouteGuards(route) {
    var session = Store.getSession();
    if (!session && route.path !== "/login") {
      Router.go("#/login");
      return false;
    }

    if (session) {
      state.user = Store.getCurrentUser();
    } else {
      state.user = null;
    }

    if (!session) {
      return true;
    }

    if (state.user.role === "STUDENT" && supervisorOnly.indexOf(route.path) > -1) {
      Router.go("#/student");
      return false;
    }

    if (state.user.role === "SUPERVISOR" && route.path === "/student") {
      Router.go("#/dashboard");
      return false;
    }

    if (route.path === "/projects/:id" && state.user.role === "STUDENT") {
      var project = Store.getProjectById(route.params.id);
      if (!project || project.studentIds.indexOf(state.user.id) === -1) {
        Router.go("#/student");
        return false;
      }
    }

    return true;
  }

  function bindShellEvents() {
    document.querySelectorAll("[data-nav]").forEach(function (button) {
      button.addEventListener("click", function () {
        Router.go(button.getAttribute("data-nav"));
      });
    });

    var logout = el("logout-btn");
    if (logout) {
      logout.addEventListener("click", function () {
        Store.clearSession();
        UI.toast("Logged out");
        Router.go("#/login");
      });
    }

    var gs = el("global-search");
    if (gs) {
      gs.addEventListener("input", function () {
        state.search = gs.value.trim();
        renderCurrentRoute();
      });
    }
  }

  function renderLayout(contentHtml) {
    var shell = el("app-shell");
    if (!state.user && state.route.path === "/login") {
      shell.classList.add("login-shell");
      el("sidebar").classList.add("hidden");
      el("topbar").classList.add("hidden");
    } else {
      shell.classList.remove("login-shell");
      el("sidebar").classList.remove("hidden");
      el("topbar").classList.remove("hidden");
    }

    el("sidebar").innerHTML = sidebarHtml();
    el("topbar").innerHTML = topbarHtml();
    el("content").innerHTML = contentHtml;
    bindShellEvents();
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
      '<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="login-submit">Login</button></div>' +
      '<p class="notice">All accounts use password: <strong>demo123</strong></p>' +
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
      var session = Store.login(email, password);
      if (!session) {
        UI.toast("Invalid credentials");
        return;
      }
      UI.toast("Login successful");
      Router.go(session.role === "SUPERVISOR" ? "#/dashboard" : "#/student");
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

    Store.simulate({ projects: projects, stats: Store.statsForDashboard(projects) }).then(function (payload) {
      var rows = payload.projects.filter(function (p) { return projectMatchesSearch(p, users); }).map(function (p) {
        var integration = !p.githubUrl && !p.jiraProjectKey;
        return '<tr>' +
          '<td>' + UI.escapeHtml(p.title) + '</td>' +
          '<td>' + UI.statusBadge(p.status) + '</td>' +
          '<td>' + UI.formatDateTime(p.analytics.lastActivityAt) + '</td>' +
          '<td>' + p.analytics.commitsWeek + '</td>' +
          '<td>' + p.analytics.openIssues + '</td>' +
          '<td>' + UI.formatDate(p.milestoneDate) + '</td>' +
          '<td><button class="btn small" data-open-project="' + p.id + '">Open</button> <button class="btn small" data-open-tab="meetings" data-open-project="' + p.id + '">Meetings</button> <button class="btn small" data-open-tab="files" data-open-project="' + p.id + '">Files</button></td>' +
          "</tr>" +
          (integration ? '<tr><td colspan="7"><div class="notice">Integrations not configured for this project.</div></td></tr>' : "");
      }).join("");

      renderLayout(
        title("Supervisor Dashboard") +
        '<div class="grid cards-5" style="margin-bottom:14px">' +
          metricCard("Total Projects", payload.stats.total) +
          metricCard("On Track", payload.stats.onTrack) +
          metricCard("At Risk", payload.stats.atRisk) +
          metricCard("Behind", payload.stats.behind) +
          metricCard("Overdue Action Items", payload.stats.overdue) +
        "</div>" +
        '<div class="grid cards-4" style="margin-bottom:14px">' +
          metricCard("Active Students This Week", payload.stats.activeStudents) +
          '<div class="card" style="grid-column: span 3"><div class="metric-label">Integration Health</div><div class="meta">Projects with missing GitHub/Jira setup show gentle warnings in the table.</div></div>' +
        "</div>" +
        '<div class="card" style="margin-bottom:14px"><h3 style="margin:0 0 8px">Project Health Table</h3><div class="table-wrap"><table class="table"><thead><tr><th>Project</th><th>Status</th><th>Last Activity</th><th>Commits This Week</th><th>Open Jira</th><th>Next Milestone</th><th>Quick Actions</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="7"><div class="empty">No projects match current search.</div></td></tr>') +
        "</tbody></table></div></div>" +
        '<div class="split"><div class="card"><h3 style="margin:0 0 10px">Activity Over Time (6 weeks)</h3><canvas id="activity-line" width="620" height="220"></canvas></div><div class="card"><h3 style="margin:0 0 10px">Commits by Project</h3><canvas id="activity-bars" width="310" height="220"></canvas></div></div>'
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

      bindOpenProjectButtons();
    });
  }

  function metricCard(label, value) {
    return '<div class="card"><div class="metric-label">' + UI.escapeHtml(label) + '</div><div class="metric-value">' + value + "</div></div>";
  }

  function bindOpenProjectButtons() {
    document.querySelectorAll("[data-open-project]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-open-project");
        var tab = btn.getAttribute("data-open-tab");
        var target = "#/projects/" + id;
        if (tab) {
          target += "?tab=" + tab;
        }
        Router.go(target);
      });
    });
  }

  function renderProjectsList() {
    var projects = Store.getProjectsForUser(state.user);
    var users = Store.listStudents();

    renderLayout(
      title(state.user.role === "SUPERVISOR" ? "Projects" : "My Projects") +
      '<div class="card" style="margin-bottom:14px"><div class="row wrap">' +
      '<input id="project-search" placeholder="Search by title/student" style="max-width:240px" value="' + UI.escapeHtml(state.search) + '" />' +
      '<select id="filter-status" style="max-width:180px"><option value="">All Statuses</option><option>On track</option><option>At risk</option><option>Behind</option></select>' +
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
        var matchStatus = !status || p.status === status;
        var matchInteg = !integ || (integ === "github" && !!p.githubUrl) || (integ === "jira" && !!p.jiraProjectKey) || (integ === "none" && !p.githubUrl && !p.jiraProjectKey);
        return matchQ && matchStatus && matchInteg;
      }).map(function (p) {
        return '<div class="card project-card">' +
          '<h3>' + UI.escapeHtml(p.title) + '</h3>' +
          '<div class="meta">Students: ' + p.studentIds.length + ' | Last activity: ' + UI.formatDateTime(p.analytics.lastActivityAt) + '</div>' +
          '<div class="row wrap" style="margin:8px 0">' + UI.statusBadge(p.status) +
          '<span class="badge ' + (p.githubUrl ? "on-track" : "behind") + '">GitHub: ' + (p.githubUrl ? "Connected" : "Not configured") + '</span>' +
          '<span class="badge ' + (p.jiraProjectKey ? "on-track" : "behind") + '">Jira: ' + (p.jiraProjectKey ? "Connected" : "Not configured") + "</span></div>" +
          '<button class="btn" data-open-project="' + p.id + '">Open Project</button>' +
          "</div>";
      }).join("");

      el("projects-grid").innerHTML = html || '<div class="empty">No projects found.</div>';
      bindOpenProjectButtons();
    }

    ["project-search", "filter-status", "filter-integration"].forEach(function (id) {
      el(id).addEventListener("input", applyFilters);
      el(id).addEventListener("change", applyFilters);
    });

    var np = el("new-project-btn");
    if (np) {
      np.addEventListener("click", function () {
        Router.go("#/projects/new");
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

    function screen() {
      var html = title("Create New Project") + '<div class="card">';
      html += '<div class="tabs"><span class="tab ' + (step === 1 ? "active" : "") + '">Step 1: Basic Info</span><span class="tab ' + (step === 2 ? "active" : "") + '">Step 2: Connections</span></div>';
      if (step === 1) {
        html += '<div class="form-grid">' +
          '<div class="full"><label>Project Title *</label><input id="w-title" value="' + UI.escapeHtml(data.title) + '"/></div>' +
          '<div><label>Batch</label><input id="w-batch" value="' + UI.escapeHtml(data.batch) + '"/></div>' +
          '<div><label>Semester</label><input id="w-sem" value="' + UI.escapeHtml(data.semester) + '"/></div>' +
          '<div><label>Next Milestone Date *</label><input id="w-milestone" type="date" value="' + UI.escapeHtml(data.milestoneDate) + '"/></div>' +
          '<div class="full"><label>Assign Students *</label><div class="row wrap">' +
          students.map(function (s) {
            var checked = data.studentIds.indexOf(s.id) > -1 ? "checked" : "";
            return '<label class="btn small"><input type="checkbox" data-student="' + s.id + '" ' + checked + '/> ' + UI.escapeHtml(s.name) + "</label>";
          }).join("") +
          "</div></div></div>";
      } else {
        html += '<div class="form-grid">' +
          '<div class="full"><label>Communication Link * (Teams/Discord/WhatsApp)</label><input id="w-comms" value="' + UI.escapeHtml(data.commsLink) + '"/></div>' +
          '<div class="full"><label>GitHub Repo URL</label><input id="w-gh" value="' + UI.escapeHtml(data.githubUrl) + '"/></div>' +
          '<div><label>Jira Project Key</label><input id="w-jira" value="' + UI.escapeHtml(data.jiraProjectKey) + '"/></div>' +
          '<div><label>Jira Board Link (optional)</label><input id="w-jira-board" value="' + UI.escapeHtml(data.jiraBoardLink) + '"/></div>' +
          "</div>";
      }
      html += '<div class="row" style="justify-content:flex-end;margin-top:14px">';
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
          Router.go("#/projects/" + created.id);
        }
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
    var tabs = ["overview", "activity", "meetings", "action-items", "files"];
    var currentTab = tabs.indexOf(activeTab) > -1 ? activeTab : "overview";
    var canEdit = state.user.role === "SUPERVISOR";

    function tabButton(t, label) {
      return '<button class="tab ' + (currentTab === t ? "active" : "") + '" data-tab="' + t + '">' + label + "</button>";
    }

    var html = title(project.title) +
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
        Router.go("#/projects/" + projectId + "?tab=" + btn.getAttribute("data-tab"));
      });
    });

    var tabBody = el("tab-body");

    if (currentTab === "overview") {
      tabBody.innerHTML = '<div class="split"><div class="card">' +
        '<h3 style="margin:0 0 10px">Project Info</h3>' +
        '<div class="kv"><div>Batch</div><div>' + UI.escapeHtml(project.batch) + '</div><div>Semester</div><div>' + UI.escapeHtml(project.semester) + '</div><div>Milestone</div><div>' + UI.formatDate(project.milestoneDate) + '</div><div>Status</div><div>' + UI.statusBadge(project.status) + '</div></div>' +
        '<h4>Members</h4><div class="row wrap">' + project.studentIds.map(function (sid) {
          var s = byId(students, sid);
          return '<span class="badge on-track">' + UI.escapeHtml(s ? s.name : sid) + '</span>';
        }).join("") + '</div>' +
        '<div style="margin-top:12px"><a class="btn primary" href="' + UI.escapeHtml(project.commsLink) + '" target="_blank" rel="noreferrer">Open Communication Channel</a></div>' +
        '</div><div class="card"><h3 style="margin:0 0 10px">Integrations</h3>' +
        '<div class="meta">GitHub: ' + (project.githubUrl ? "Connected" : "Not configured") + '</div>' +
        '<div class="meta" style="margin-bottom:10px">Jira: ' + (project.jiraProjectKey ? "Connected" : "Not configured") + '</div>' +
        (project.githubUrl ? '<a href="' + UI.escapeHtml(project.githubUrl) + '" target="_blank" class="btn small">Repo</a>' : "") +
        (project.jiraBoardLink ? ' <a href="' + UI.escapeHtml(project.jiraBoardLink) + '" target="_blank" class="btn small">Board</a>' : "") +
        (canEdit ? '<div style="margin-top:10px"><button class="btn" id="edit-connections">Connect Integrations</button></div>' : "") +
        '</div></div>';

      if (canEdit) {
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
      tabBody.innerHTML = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Meetings</h3>' + (canEdit ? '<button class="btn primary" id="add-meeting">Add Meeting Minutes</button>' : "") + '</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Date</th><th>Summary</th><th>Actions</th></tr></thead><tbody>' +
      (meetings.map(function (m) {
        return '<tr><td>' + UI.escapeHtml(m.title) + '</td><td>' + UI.formatDate(m.date) + '</td><td>' + UI.escapeHtml(m.summary.slice(0, 70)) + '</td><td><button class="btn small" data-view-meeting="' + m.id + '">View</button></td></tr>';
      }).join("") || '<tr><td colspan="4"><div class="empty">No meetings yet.</div></td></tr>') +
      '</tbody></table></div>';

      if (canEdit) {
        el("add-meeting").addEventListener("click", function () {
          openMeetingModal(project, students);
        });
      }
      document.querySelectorAll("[data-view-meeting]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var meeting = Store.getMeetingById(btn.getAttribute("data-view-meeting"));
          if (!meeting) {
            return;
          }
          var aItems = Store.listActionItems(project.id).filter(function (a) { return a.meetingId === meeting.id; });
          UI.openModal("Meeting Detail", '<p><strong>' + UI.escapeHtml(meeting.title) + '</strong> - ' + UI.formatDate(meeting.date) + '</p><p>' + UI.escapeHtml(meeting.summary) + '</p><p><strong>Decisions:</strong> ' + UI.escapeHtml(meeting.decisions) + '</p><h4>Action Items</h4><ul>' + aItems.map(function (a) {
            var owner = byId(students, a.ownerId);
            return '<li>' + UI.escapeHtml(a.description) + ' (' + UI.escapeHtml(owner ? owner.name : a.ownerId) + ')</li>';
          }).join("") + "</ul>", '');
        });
      });
    }

    if (currentTab === "action-items") {
      tabBody.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Description</th><th>Owner</th><th>Due</th><th>Status</th><th>Priority</th><th>Meeting</th><th>Jira</th><th>Actions</th></tr></thead><tbody>' +
      (actions.map(function (a) {
        var owner = byId(students, a.ownerId);
        return '<tr>' +
          '<td>' + UI.escapeHtml(a.description) + '</td>' +
          '<td>' + UI.escapeHtml(owner ? owner.name : a.ownerId) + '</td>' +
          '<td>' + UI.formatDate(a.dueDate) + '</td>' +
          '<td><select data-action-status="' + a.id + '"><option ' + (a.status === "Todo" ? "selected" : "") + '>Todo</option><option ' + (a.status === "In Progress" ? "selected" : "") + '>In Progress</option><option ' + (a.status === "Done" ? "selected" : "") + '>Done</option></select></td>' +
          '<td>' + UI.escapeHtml(a.priority) + '</td>' +
          '<td>' + UI.escapeHtml((meetings.find(function (m) { return m.id === a.meetingId; }) || {}).title || "-") + '</td>' +
          '<td>' + (a.jira ? '<a href="' + UI.escapeHtml(a.jira.url) + '" target="_blank">' + UI.escapeHtml(a.jira.key) + '</a>' : "-") + '</td>' +
          '<td>' +
          (canEdit ? '<button class="btn small" data-create-jira="' + a.id + '">Create Jira Task</button> <button class="btn small" data-link-jira="' + a.id + '">Link Existing Jira</button>' : "") +
          '</td>' +
          "</tr>";
      }).join("") || '<tr><td colspan="8"><div class="empty">No action items yet.</div></td></tr>') +
      '</tbody></table></div>';

      document.querySelectorAll("[data-action-status]").forEach(function (select) {
        select.addEventListener("change", function () {
          Store.updateActionItemStatus(select.getAttribute("data-action-status"), select.value);
          UI.toast("Action item status updated");
        });
      });

      if (canEdit) {
        document.querySelectorAll("[data-create-jira]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            if (!project.jiraProjectKey) {
              UI.toast("Jira not configured for this project. Add project key.");
              return;
            }
            var updated = Store.createMockJiraForAction(btn.getAttribute("data-create-jira"), project.id);
            if (updated) {
              UI.toast("Jira task created: " + updated.jira.key);
              renderProjectView(projectId, "action-items");
            }
          });
        });

        document.querySelectorAll("[data-link-jira]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            openLinkJiraModal(btn.getAttribute("data-link-jira"), projectId);
          });
        });
      }
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
      project.githubUrl = el("m-gh").value.trim();
      project.jiraProjectKey = el("m-jira").value.trim().toUpperCase();
      project.jiraBoardLink = el("m-jira-board").value.trim();
      project.commsLink = el("m-comms").value.trim();
      Store.upsertProject(project);
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
        '<div><label>Owner</label><select data-a-owner="' + idx + '">' + students.map(function (s) { return '<option value="' + s.id + '">' + UI.escapeHtml(s.name) + '</option>'; }).join("") + '</select></div>' +
        '<div><label>Due Date</label><input data-a-due="' + idx + '" type="date" /></div>' +
        '<div><label>Priority</label><select data-a-priority="' + idx + '"><option>High</option><option>Medium</option><option>Low</option></select></div>' +
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
          ownerId: owner ? owner.value : project.studentIds[0],
          dueDate: due && due.value ? due.value : new Date().toISOString().slice(0, 10),
          priority: pri ? pri.value : "Medium",
          jira: jira
        };
      }).filter(Boolean);

      Store.addMeeting(project.id, { title: title, date: date, summary: summary, decisions: decisions }, actionItems);
      UI.closeModal();
      UI.toast("Meeting minutes saved");
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
      Store.linkActionItemJira(actionId, { key: key, url: url });
      UI.closeModal();
      UI.toast("Jira link saved");
      renderProjectView(projectId, "action-items");
    });
  }

  function renderStudentHome() {
    var projects = Store.getProjectsForUser(state.user);
    var myActions = Store.listMyActionItems(state.user.id);
    var soon = myActions.filter(function (a) {
      var dd = new Date(a.dueDate);
      var now = new Date();
      var week = new Date();
      week.setDate(now.getDate() + 7);
      return dd >= now && dd <= week && a.status !== "Done";
    });

    var recentMeetings = [];
    projects.forEach(function (p) {
      recentMeetings = recentMeetings.concat(Store.listMeetings(p.id));
    });
    recentMeetings.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    renderLayout(
      title("Student Home") +
      '<div class="split"><div class="card"><h3 style="margin:0 0 10px">Assigned Projects</h3>' +
      (projects.map(function (p) {
        return '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--border);padding:8px 0"><div><strong>' + UI.escapeHtml(p.title) + '</strong><div class="meta">Milestone: ' + UI.formatDate(p.milestoneDate) + '</div></div><button class="btn small" data-open-project="' + p.id + '">Open</button></div>';
      }).join("") || '<div class="empty">No assigned projects.</div>') +
      '</div><div class="card"><h3 style="margin:0 0 10px">My Action Items Due Soon</h3>' +
      (soon.map(function (a) {
        return '<div style="border-bottom:1px solid var(--border);padding:8px 0"><strong>' + UI.escapeHtml(a.description) + '</strong><div class="meta">Due ' + UI.formatDate(a.dueDate) + ' | ' + UI.escapeHtml(a.status) + '</div></div>';
      }).join("") || '<div class="empty">No upcoming due items.</div>') +
      '</div></div>' +
      '<div class="card" style="margin-top:14px"><h3 style="margin:0 0 10px">Recent Meetings</h3><div class="table-wrap"><table class="table"><thead><tr><th>Project</th><th>Title</th><th>Date</th></tr></thead><tbody>' +
      (recentMeetings.slice(0, 8).map(function (m) {
        var p = byId(projects, m.projectId);
        return '<tr><td>' + UI.escapeHtml(p ? p.title : "-") + '</td><td>' + UI.escapeHtml(m.title) + '</td><td>' + UI.formatDate(m.date) + '</td></tr>';
      }).join("") || '<tr><td colspan="3"><div class="empty">No meetings yet.</div></td></tr>') +
      '</tbody></table></div></div>'
    );

    bindOpenProjectButtons();
  }

  function renderCurrentRoute() {
    if (!state.route) {
      return;
    }

    if (!enforceRouteGuards(state.route)) {
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
      renderProjectsList();
      return;
    }

    if (state.route.path === "/projects/new") {
      renderProjectWizard();
      return;
    }

    if (state.route.path === "/projects/:id") {
      renderProjectView(state.route.params.id, state.route.query.tab);
      return;
    }

    if (state.route.path === "/student") {
      renderStudentHome();
      return;
    }

    Router.go(state.user && state.user.role === "STUDENT" ? "#/student" : "#/dashboard");
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
