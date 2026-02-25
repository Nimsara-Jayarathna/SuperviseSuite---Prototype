(function () {
  function makeId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function dateOffset(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  function dateOffsetOnly(days) {
    return dateOffset(days).slice(0, 10);
  }

  function audit(type, byUserId, meta, daysAgo) {
    return {
      id: makeId("ev"),
      timestamp: dateOffset(-(daysAgo || 0)),
      type: type,
      byUserId: byUserId,
      meta: meta || {}
    };
  }

  function seedProject(projectId, title, cfg) {
    return {
      id: projectId,
      title: title,
      batch: "2026",
      semester: cfg.semester || "Semester 1",
      lifecycleStatus: cfg.lifecycleStatus,
      status: cfg.lifecycleStatus === "AT_RISK" ? "At risk" : (cfg.lifecycleStatus === "BEHIND" ? "Behind" : "On track"),
      studentIds: cfg.studentIds,
      commsLink: cfg.commsLink,
      githubUrl: cfg.githubUrl,
      jiraProjectKey: cfg.jiraProjectKey,
      jiraBoardLink: cfg.jiraBoardLink,
      githubIntegration: { status: cfg.githubStatus || "NOT_CONFIGURED", url: cfg.githubUrl || "" },
      jiraIntegration: { status: cfg.jiraStatus || "NOT_CONFIGURED", projectKey: cfg.jiraProjectKey || "", boardLink: cfg.jiraBoardLink || "" },
      commsIntegration: { status: cfg.commsStatus || "NOT_CONFIGURED", link: cfg.commsLink || "" },
      milestoneDate: cfg.milestoneDate,
      createdAt: dateOffset(-(45 - cfg.offset)),
      createdBy: "u_sup",
      overdueCount: cfg.overdueCount || 0,
      healthSuggestedStatus: cfg.healthSuggestedStatus || null,
      openActionItems: cfg.openActionItems || 0,
      meetingCount: cfg.meetingCount || 0,
      auditEvents: cfg.auditEvents || [],
      analytics: {
        commitsWeek: cfg.commitsWeek,
        openIssues: cfg.openIssues,
        jiraTodo: cfg.jiraTodo,
        jiraInProgress: cfg.jiraInProgress,
        jiraDone: cfg.jiraDone,
        lastActivityAt: dateOffset(-(cfg.offset % 6 + 1)),
        activityWeeks: [
          2 + (cfg.offset % 3),
          4 + (cfg.offset % 4),
          3 + (cfg.offset % 5),
          5 + (cfg.offset % 4),
          4 + (cfg.offset % 3),
          3 + (cfg.offset % 2)
        ],
        contributions: cfg.studentIds.map(function (sid, idx) {
          return { userId: sid, commits: 4 + cfg.offset + idx * 2, prs: 1 + idx + (cfg.offset % 2) };
        })
      }
    };
  }

  function generateSeedData() {
    var users = [
      { id: "u_sup", name: "Dr. Maya Perera", fullName: "Dr. Maya Perera", email: "supervisor@demo.com", password: "demo123", role: "SUPERVISOR", createdAt: dateOffset(-200) }
    ];

    for (var i = 1; i <= 6; i += 1) {
      users.push({
        id: "u_stu_" + i,
        name: "Student " + i,
        fullName: "Student " + i,
        email: "student" + i + "@demo.com",
        password: "demo123",
        role: "STUDENT",
        createdAt: dateOffset(-(180 - i))
      });
    }

    var projects = [
      seedProject("p_1", "Campus Safety Analytics", {
        offset: 1,
        lifecycleStatus: "ACTIVE",
        studentIds: ["u_stu_1", "u_stu_3"],
        commsLink: "https://teams.microsoft.com/l/channel/mock-campus",
        githubUrl: "https://github.com/demo-org/campus-safety",
        jiraProjectKey: "SAFE",
        jiraBoardLink: "https://jira.example.com/boards/101",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(16),
        commitsWeek: 9,
        openIssues: 4,
        jiraTodo: 3,
        jiraInProgress: 2,
        jiraDone: 8,
        auditEvents: [
          audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 18),
          audit("STATUS_CHANGED", "u_sup", { fromStatus: "DRAFT", toStatus: "ACTIVE" }, 15),
          audit("INTEGRATION_UPDATED", "u_sup", { commsStatus: "CONNECTED" }, 14)
        ]
      }),
      seedProject("p_2", "Smart Attendance Tracker", {
        offset: 2,
        lifecycleStatus: "BEHIND",
        studentIds: ["u_stu_2", "u_stu_4"],
        commsLink: "https://meet.google.com/abc-defg-hij",
        githubUrl: "https://github.com/demo-org/smart-attendance",
        jiraProjectKey: "SYNC",
        jiraBoardLink: "https://jira.example.com/boards/102",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(-4),
        overdueCount: 2,
        healthSuggestedStatus: "BEHIND",
        commitsWeek: 3,
        openIssues: 7,
        jiraTodo: 5,
        jiraInProgress: 3,
        jiraDone: 4,
        auditEvents: [
          audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 24),
          audit("STATUS_CHANGED", "u_sup", { fromStatus: "ACTIVE", toStatus: "BEHIND" }, 3)
        ]
      }),
      seedProject("p_3", "E-Library Recommendation Engine", {
        offset: 3,
        lifecycleStatus: "AT_RISK",
        studentIds: ["u_stu_5", "u_stu_1"],
        commsLink: "https://discord.com/channels/mock-library",
        githubUrl: "https://github.com/demo-org/elibrary-reco",
        jiraProjectKey: "ANL",
        jiraBoardLink: "https://jira.example.com/boards/103",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(5),
        overdueCount: 2,
        healthSuggestedStatus: "AT_RISK",
        commitsWeek: 4,
        openIssues: 6,
        jiraTodo: 4,
        jiraInProgress: 2,
        jiraDone: 6,
        auditEvents: [
          audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 20),
          audit("MEETING_SUBMITTED", "u_stu_5", { meetingId: "m_p3_submitted" }, 1)
        ]
      }),
      seedProject("p_4", "IoT Energy Monitor", {
        offset: 4,
        lifecycleStatus: "COMPLETED",
        studentIds: ["u_stu_3", "u_stu_6"],
        commsLink: "https://zoom.us/j/1234567890",
        githubUrl: "https://github.com/demo-org/iot-energy",
        jiraProjectKey: "EDU",
        jiraBoardLink: "https://jira.example.com/boards/104",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(-9),
        commitsWeek: 1,
        openIssues: 0,
        jiraTodo: 0,
        jiraInProgress: 0,
        jiraDone: 14,
        auditEvents: [
          audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 42),
          audit("STATUS_CHANGED", "u_sup", { fromStatus: "ACTIVE", toStatus: "COMPLETED" }, 6)
        ]
      }),
      seedProject("p_5", "Student Wellbeing Dashboard", {
        offset: 5,
        lifecycleStatus: "DRAFT",
        studentIds: ["u_stu_2", "u_stu_6"],
        commsLink: "teams://invalid-link",
        githubUrl: "",
        jiraProjectKey: "",
        jiraBoardLink: "",
        githubStatus: "NOT_CONFIGURED",
        jiraStatus: "NOT_CONFIGURED",
        commsStatus: "ERROR",
        milestoneDate: dateOffsetOnly(22),
        commitsWeek: 0,
        openIssues: 0,
        jiraTodo: 0,
        jiraInProgress: 0,
        jiraDone: 0,
        auditEvents: [
          audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 2),
          audit("INTEGRATION_UPDATED", "u_sup", { commsStatus: "ERROR" }, 1)
        ]
      }),
      seedProject("p_6", "Transport Route Optimizer", {
        offset: 6,
        lifecycleStatus: "ACTIVE",
        studentIds: ["u_stu_4", "u_stu_5"],
        commsLink: "https://chat.whatsapp.com/mocktransport",
        githubUrl: "https://github.com/demo-org/transport-opt",
        jiraProjectKey: "PORT",
        jiraBoardLink: "https://jira.example.com/boards/106",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(14),
        commitsWeek: 7,
        openIssues: 3,
        jiraTodo: 2,
        jiraInProgress: 2,
        jiraDone: 7,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 28)]
      }),
      seedProject("p_7", "Exam Grading Assistant", {
        offset: 7,
        lifecycleStatus: "ACTIVE",
        studentIds: ["u_stu_1", "u_stu_2"],
        commsLink: "https://teams.microsoft.com/l/channel/mock-exam",
        githubUrl: "https://github.com/demo-org/grading-assistant",
        jiraProjectKey: "GRD",
        jiraBoardLink: "https://jira.example.com/boards/107",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(28),
        commitsWeek: 10,
        openIssues: 2,
        jiraTodo: 1,
        jiraInProgress: 2,
        jiraDone: 10,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 31)]
      }),
      seedProject("p_8", "Alumni Networking Portal", {
        offset: 8,
        lifecycleStatus: "AT_RISK",
        studentIds: ["u_stu_3", "u_stu_5"],
        commsLink: "https://meet.google.com/mock-alumni-room",
        githubUrl: "https://github.com/demo-org/alumni-portal",
        jiraProjectKey: "ALUM",
        jiraBoardLink: "https://jira.example.com/boards/108",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(4),
        commitsWeek: 2,
        openIssues: 8,
        jiraTodo: 4,
        jiraInProgress: 4,
        jiraDone: 3,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 21)]
      }),
      seedProject("p_9", "Lab Asset Management", {
        offset: 9,
        lifecycleStatus: "ACTIVE",
        studentIds: ["u_stu_6", "u_stu_4"],
        commsLink: "https://discord.com/channels/mock-lab",
        githubUrl: "github.com/demo-org/bad-url",
        jiraProjectKey: "LAB",
        jiraBoardLink: "jira.example.com/boards/109",
        githubStatus: "ERROR",
        jiraStatus: "ERROR",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(11),
        commitsWeek: 5,
        openIssues: 5,
        jiraTodo: 3,
        jiraInProgress: 2,
        jiraDone: 5,
        auditEvents: [
          audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 17),
          audit("INTEGRATION_UPDATED", "u_sup", { githubStatus: "ERROR", jiraStatus: "ERROR" }, 5)
        ]
      }),
      seedProject("p_10", "Peer Tutoring Matchmaker", {
        offset: 10,
        lifecycleStatus: "ACTIVE",
        studentIds: ["u_stu_2", "u_stu_3"],
        commsLink: "https://zoom.us/j/9876543210",
        githubUrl: "https://github.com/demo-org/tutoring-match",
        jiraProjectKey: "TUTOR",
        jiraBoardLink: "https://jira.example.com/boards/110",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(9),
        commitsWeek: 6,
        openIssues: 2,
        jiraTodo: 2,
        jiraInProgress: 1,
        jiraDone: 8,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 26)]
      })
    ];

    var meetings = [
      {
        id: "m_p3_submitted",
        projectId: "p_3",
        title: "Progress Review - Recommendation Engine",
        date: dateOffset(-1),
        summary: "Discussed personalization quality, unresolved data skew, and testing gaps.",
        decisions: "Prioritize recommendation confidence scoring and fix dataset imbalance.",
        actionItemIds: ["a_p3_1", "a_p3_2"],
        status: "SUBMITTED",
        createdAt: dateOffset(-1),
        createdBy: "u_stu_5",
        submittedAt: dateOffset(-1),
        submittedBy: "u_stu_5",
        approvedAt: null,
        approvedBy: null
      },
      {
        id: "m_p2_approved",
        projectId: "p_2",
        title: "Recovery Planning Session",
        date: dateOffset(-6),
        summary: "Reviewed delayed milestones and blockers around deployment.",
        decisions: "Split deployment into phased rollout and assign owners for urgent blockers.",
        actionItemIds: ["a_p2_1", "a_p2_2"],
        status: "APPROVED",
        createdAt: dateOffset(-6),
        createdBy: "u_sup",
        submittedAt: dateOffset(-5),
        submittedBy: "u_stu_2",
        approvedAt: dateOffset(-4),
        approvedBy: "u_sup"
      },
      {
        id: "m_p1_draft",
        projectId: "p_1",
        title: "Sprint Planning - Campus Safety",
        date: dateOffset(-2),
        summary: "Prepared next sprint scope and discussed API testing plan.",
        decisions: "Track backend latency and close high-priority bug list.",
        actionItemIds: ["a_p1_1"],
        status: "DRAFT",
        createdAt: dateOffset(-2),
        createdBy: "u_sup"
      }
    ];

    var actionItems = [
      {
        id: "a_p3_1",
        projectId: "p_3",
        meetingId: "m_p3_submitted",
        createdFromMeetingId: "m_p3_submitted",
        description: "Tune recommendation relevance model for new-user cold-start.",
        assigneeId: "u_stu_5",
        ownerId: "u_stu_5",
        dueDate: dateOffsetOnly(2),
        status: "In Progress",
        priority: "HIGH",
        jira: { key: "ANL-140", url: "https://jira.example.com/browse/ANL-140" },
        createdAt: dateOffset(-1),
        lastUpdatedAt: dateOffset(-1),
        lastUpdatedBy: "u_stu_5",
        comments: [],
        notes: [],
        evidenceLink: "",
        isOfficial: false,
        fieldsLocked: false
      },
      {
        id: "a_p3_2",
        projectId: "p_3",
        meetingId: "m_p3_submitted",
        createdFromMeetingId: "m_p3_submitted",
        description: "Prepare ablation test report for recommendation pipeline.",
        assigneeId: "u_stu_1",
        ownerId: "u_stu_1",
        dueDate: dateOffsetOnly(4),
        status: "Todo",
        priority: "MEDIUM",
        jira: null,
        createdAt: dateOffset(-1),
        lastUpdatedAt: dateOffset(-1),
        lastUpdatedBy: "u_stu_5",
        comments: [],
        notes: [],
        evidenceLink: "",
        isOfficial: false,
        fieldsLocked: false
      },
      {
        id: "a_p2_1",
        projectId: "p_2",
        meetingId: "m_p2_approved",
        createdFromMeetingId: "m_p2_approved",
        description: "Resolve failed CI pipeline and publish deployment checklist.",
        assigneeId: "u_stu_2",
        ownerId: "u_stu_2",
        dueDate: dateOffsetOnly(-2),
        status: "In Progress",
        priority: "HIGH",
        jira: { key: "SYNC-203", url: "https://jira.example.com/browse/SYNC-203" },
        createdAt: dateOffset(-6),
        lastUpdatedAt: dateOffset(-3),
        lastUpdatedBy: "u_stu_2",
        comments: [
          { id: makeId("note"), text: "CI failure rooted in flaky test env", byUserId: "u_stu_2", createdAt: dateOffset(-3) }
        ],
        notes: [
          { id: makeId("note"), text: "CI failure rooted in flaky test env", byUserId: "u_stu_2", createdAt: dateOffset(-3) }
        ],
        evidenceLink: "",
        isOfficial: true,
        fieldsLocked: true
      },
      {
        id: "a_p2_2",
        projectId: "p_2",
        meetingId: "m_p2_approved",
        createdFromMeetingId: "m_p2_approved",
        description: "Patch attendance export performance regression.",
        assigneeId: "u_stu_4",
        ownerId: "u_stu_4",
        dueDate: dateOffsetOnly(-1),
        status: "Todo",
        priority: "HIGH",
        jira: null,
        createdAt: dateOffset(-6),
        lastUpdatedAt: dateOffset(-6),
        lastUpdatedBy: "u_sup",
        comments: [],
        notes: [],
        evidenceLink: "",
        isOfficial: true,
        fieldsLocked: true
      },
      {
        id: "a_p1_1",
        projectId: "p_1",
        meetingId: "m_p1_draft",
        createdFromMeetingId: "m_p1_draft",
        description: "Draft security test cases for emergency alert module.",
        assigneeId: "u_stu_3",
        ownerId: "u_stu_3",
        dueDate: dateOffsetOnly(5),
        status: "Todo",
        priority: "MEDIUM",
        jira: null,
        createdAt: dateOffset(-2),
        lastUpdatedAt: dateOffset(-2),
        lastUpdatedBy: "u_sup",
        comments: [],
        notes: [],
        evidenceLink: "",
        isOfficial: false,
        fieldsLocked: false
      },
      {
        id: "a_p6_1",
        projectId: "p_6",
        meetingId: null,
        createdFromMeetingId: null,
        description: "Finalize route-cost heuristic evaluation.",
        assigneeId: "u_stu_5",
        ownerId: "u_stu_5",
        dueDate: dateOffsetOnly(3),
        status: "Todo",
        priority: "MEDIUM",
        jira: { key: "PORT-230", url: "https://jira.example.com/browse/PORT-230" },
        createdAt: dateOffset(-2),
        lastUpdatedAt: dateOffset(-2),
        lastUpdatedBy: "u_sup",
        comments: [],
        notes: [],
        evidenceLink: "",
        isOfficial: false,
        fieldsLocked: false
      }
    ];

    var files = [
      {
        id: makeId("f"),
        projectId: "p_1",
        name: "requirements_campus_safety.pdf",
        size: 58400,
        type: "application/pdf",
        uploadedAt: dateOffset(-2),
        uploaderId: "u_stu_1"
      },
      {
        id: makeId("f"),
        projectId: "p_3",
        name: "reco_model_notes.docx",
        size: 84200,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        uploadedAt: dateOffset(-1),
        uploaderId: "u_stu_5"
      }
    ];

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
