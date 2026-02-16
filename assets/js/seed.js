(function () {
  function makeId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function dateOffset(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  function generateSeedData() {
    var users = [
      { id: "u_sup", name: "Dr. Maya Perera", email: "supervisor@demo.com", password: "demo123", role: "SUPERVISOR" }
    ];

    for (var i = 1; i <= 6; i += 1) {
      users.push({
        id: "u_stu_" + i,
        name: "Student " + i,
        email: "student" + i + "@demo.com",
        password: "demo123",
        role: "STUDENT"
      });
    }

    var statuses = ["On track", "At risk", "Behind"];
    var projectNames = [
      "Campus Safety Analytics",
      "Smart Attendance Tracker",
      "E-Library Recommendation Engine",
      "IoT Energy Monitor",
      "Student Wellbeing Dashboard",
      "Transport Route Optimizer",
      "Exam Grading Assistant",
      "Alumni Networking Portal",
      "Lab Asset Management",
      "Peer Tutoring Matchmaker"
    ];

    var projects = [];
    var meetings = [];
    var actionItems = [];
    var files = [];

    for (var p = 0; p < 10; p += 1) {
      var id = "p_" + (p + 1);
      var assigned = ["u_stu_" + ((p % 6) + 1), "u_stu_" + (((p + 2) % 6) + 1)];
      var githubConnected = p % 3 !== 0;
      var jiraConnected = p % 4 !== 0;
      var milestone = new Date();
      milestone.setDate(milestone.getDate() + (p + 1) * 7);

      projects.push({
        id: id,
        title: projectNames[p],
        batch: "2026",
        semester: "Semester " + ((p % 2) + 1),
        status: statuses[p % 3],
        studentIds: assigned,
        commsLink: p % 2 === 0 ? "https://teams.microsoft.com/l/channel/mock-" + (p + 1) : "https://discord.com/channels/mock-" + (p + 1),
        githubUrl: githubConnected ? "https://github.com/demo-org/project-" + (p + 1) : "",
        jiraProjectKey: jiraConnected ? ["PORT", "SYNC", "ANL", "EDU"][p % 4] : "",
        jiraBoardLink: jiraConnected ? "https://jira.example.com/boards/" + (100 + p) : "",
        milestoneDate: milestone.toISOString().slice(0, 10),
        createdAt: dateOffset(-50 + p),
        createdBy: "u_sup",
        analytics: {
          commitsWeek: 4 + (p * 2),
          openIssues: 2 + (p % 6),
          jiraTodo: 2 + (p % 5),
          jiraInProgress: 1 + (p % 4),
          jiraDone: 4 + (p % 7),
          lastActivityAt: dateOffset(-(p % 9 + 1)),
          activityWeeks: [
            2 + (p % 3),
            3 + (p % 4),
            5 + (p % 5),
            4 + (p % 6),
            6 + (p % 3),
            3 + (p % 4)
          ],
          contributions: assigned.map(function (sid, idx) {
            return { userId: sid, commits: 5 + p + idx * 3, prs: 1 + idx + (p % 3) };
          })
        }
      });

      for (var m = 0; m < 2; m += 1) {
        var mid = makeId("m");
        var meetingDate = dateOffset(-(16 - p - m * 4));
        var a1 = makeId("a");
        var a2 = makeId("a");
        meetings.push({
          id: mid,
          projectId: id,
          title: (m === 0 ? "Sprint Planning" : "Progress Review") + " " + (p + 1),
          date: meetingDate,
          summary: "Discussion on milestones, blockers, and upcoming deliverables.",
          decisions: "Focus on testing and improve documentation quality.",
          actionItemIds: [a1, a2],
          createdAt: meetingDate
        });

        actionItems.push({
          id: a1,
          projectId: id,
          meetingId: mid,
          description: "Prepare module integration demo",
          ownerId: assigned[0],
          dueDate: dateOffset(m === 0 ? 3 : -2).slice(0, 10),
          status: m === 0 ? "Todo" : "In Progress",
          priority: "High",
          jira: jiraConnected && m === 1 ? { key: projects[projects.length - 1].jiraProjectKey + "-" + (120 + p), url: "https://jira.example.com/browse/" + projects[projects.length - 1].jiraProjectKey + "-" + (120 + p) } : null,
          createdAt: meetingDate
        });

        actionItems.push({
          id: a2,
          projectId: id,
          meetingId: mid,
          description: "Update weekly progress report",
          ownerId: assigned[1],
          dueDate: dateOffset(6 + p % 3).slice(0, 10),
          status: "Todo",
          priority: "Medium",
          jira: null,
          createdAt: meetingDate
        });
      }

      files.push({
        id: makeId("f"),
        projectId: id,
        name: "requirements_v" + (p + 1) + ".pdf",
        size: 54000 + p * 2000,
        type: "application/pdf",
        uploadedAt: dateOffset(-(p + 2)),
        uploaderId: assigned[0]
      });
    }

    return {
      users: users,
      projects: projects,
      meetings: meetings,
      actionItems: actionItems,
      files: files,
      meta: { seededAt: new Date().toISOString() }
    };
  }

  window.Seed = {
    generateSeedData: generateSeedData
  };
})();
