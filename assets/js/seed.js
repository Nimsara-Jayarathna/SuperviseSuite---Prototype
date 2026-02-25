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

  function finalizeItem(module, title, businessIntent, currentImplementation, riskPrevented, alternatives, priority, impact) {
    var createdAt = new Date().toISOString();
    return {
      id: makeId("fin"),
      module: module,
      title: title,
      businessIntent: businessIntent,
      currentImplementation: currentImplementation,
      riskPrevented: riskPrevented,
      alternatives: alternatives || [],
      clientDecision: "",
      status: "OPEN",
      priority: priority,
      impact: impact,
      owner: "CLIENT",
      createdAt: createdAt,
      updatedAt: createdAt,
      decidedAt: null
    };
  }

  function generateFinalizeSeedItems() {
    return [
      finalizeItem("AUTH_SESSION", "Supervisor creation model is controlled", "Ensure supervisory authority remains institution-governed.", "Supervisor is seeded; no supervisor self-registration in prototype.", "Prevents role escalation and fake supervisor accounts.", ["Invite-based supervisor onboarding", "Admin approval queue"], "MUST", "HIGH"),
      finalizeItem("AUTH_SESSION", "Student registration scope and verification", "Confirm the minimum registration flow needed for academic onboarding.", "Students self-register with required fields; no email verification enforcement yet.", "Avoids fake/duplicate student identities in production.", ["Email OTP verification", "Institution SSO only"], "SHOULD", "MEDIUM"),
      finalizeItem("AUTH_SESSION", "Session timeout policy (6 hours)", "Balance security and usability for lab/shared environments.", "Session expires after 6 hours of inactivity.", "Reduces risk of unauthorized access on unattended devices.", ["Role-specific timeout windows", "Keep fixed 6-hour policy"], "MUST", "HIGH"),
      finalizeItem("AUTH_SESSION", "Account state management", "Clarify if account lifecycle controls are required for governance.", "No suspend/disable states implemented in prototype.", "Prevents continued access by withdrawn users.", ["Supervisor-managed blocklist", "Admin-only deactivation"], "COULD", "MEDIUM"),

      finalizeItem("ROLES_PERMISSIONS", "Project lifecycle control remains supervisor-only", "Treat lifecycle states as official academic supervision signals.", "Only supervisor can transition lifecycle status.", "Prevents students self-marking projects completed or archived.", ["Student status-change request workflow", "Co-supervisor shared authority"], "MUST", "HIGH"),
      finalizeItem("ROLES_PERMISSIONS", "Action item editing boundaries", "Keep ownership and accountability clear per assignee.", "Students can edit only assigned items; supervisor can edit all.", "Prevents unilateral deadline/priority manipulation.", ["Student due-date change request with approval"], "MUST", "HIGH"),
      finalizeItem("ROLES_PERMISSIONS", "Meeting approval authority model", "Minutes become official only after supervisor verification.", "Students submit meeting drafts; supervisor approves.", "Avoids unauthorized finalization of supervision records.", ["No approval stage", "Dual approval"], "MUST", "HIGH"),
      finalizeItem("ROLES_PERMISSIONS", "Future co-supervisor support", "Prepare governance model for multiple supervisors per project.", "Single-supervisor assumption in prototype.", "Avoids authorization ambiguity when scaling.", ["Project-level supervisor roster"], "COULD", "MEDIUM"),

      finalizeItem("PROJECT_LIFECYCLE", "Confirm final lifecycle taxonomy", "Lock shared vocabulary for monitoring and reporting.", "States implemented: DRAFT, ACTIVE, AT_RISK, BEHIND, COMPLETED, ARCHIVED, CANCELLED.", "Avoids inconsistent status interpretation across teams.", ["Remove CANCELLED", "Merge AT_RISK and BEHIND"], "MUST", "HIGH"),
      finalizeItem("PROJECT_LIFECYCLE", "Transition blocking rules", "Align transition controls with operational readiness.", "DRAFT to ACTIVE blocked until comms integration is CONNECTED.", "Prevents projects running without communication channel.", ["Allow override with warning"], "MUST", "HIGH"),
      finalizeItem("PROJECT_LIFECYCLE", "Cancellation policy details", "Define process quality for early termination decisions.", "CANCELLED available; no mandatory reason capture.", "Avoids untraceable project termination decisions.", ["Require cancellation reason and approver"], "SHOULD", "MEDIUM"),
      finalizeItem("PROJECT_LIFECYCLE", "Archive vs delete strategy", "Retain institutional memory while controlling clutter.", "Archive state exists; hard delete flow not exposed.", "Prevents accidental permanent data loss.", ["Soft-delete with retention window"], "MUST", "HIGH"),

      finalizeItem("MEETINGS", "Approval workflow is mandatory", "Ensure meeting outcomes are official before downstream actions.", "Meeting workflow: DRAFT -> SUBMITTED -> APPROVED.", "Prevents conflicting supervision records.", ["Skip approval for low-risk meetings"], "MUST", "HIGH"),
      finalizeItem("MEETINGS", "Post-approval edit policy", "Define immutability guarantees for approved minutes.", "Approved meeting action item core fields are locked.", "Prevents historical record tampering.", ["Revision workflow with audit trail"], "MUST", "HIGH"),
      finalizeItem("MEETINGS", "Attendance capture requirement", "Clarify whether attendance is mandatory for governance.", "Prototype stores title/date/summary/decisions without attendance.", "Avoids compliance gaps if attendance is required.", ["Optional attendance section"], "COULD", "LOW"),
      finalizeItem("MEETINGS", "Scheduling scope decision", "Set expectations between planning calendar and minutes ledger.", "Prototype focuses on logging minutes, not scheduling.", "Prevents scope creep during MVP hardening.", ["Integrate scheduler later"], "SHOULD", "MEDIUM"),

      finalizeItem("ACTION_ITEMS", "Required action item fields", "Guarantee assignment clarity and execution planning.", "Assignee, due date, and priority are enforced.", "Prevents unowned or undated tasks.", ["Allow draft action items"], "MUST", "HIGH"),
      finalizeItem("ACTION_ITEMS", "Done validation evidence rule", "Ensure closure claims are auditable.", "Done requires comment OR evidence link.", "Prevents silent task closure and KPI inflation.", ["Require both comment and evidence"], "MUST", "HIGH"),
      finalizeItem("ACTION_ITEMS", "Overdue definition confirmation", "Make risk thresholds deterministic and explainable.", "Overdue = dueDate < today and status != Done.", "Prevents subjective late-task interpretation.", ["Grace period", "Weekend-aware rule"], "MUST", "HIGH"),
      finalizeItem("ACTION_ITEMS", "Reassignment policy and history", "Support change-control around ownership shifts.", "Reassignment is possible; no dedicated reassignment history screen.", "Prevents accountability confusion.", ["Mandatory reassignment reason"], "SHOULD", "MEDIUM"),
      finalizeItem("ACTION_ITEMS", "Status vocabulary extension", "Determine if blockers need explicit tracking.", "Statuses: Todo, In Progress, Done.", "Avoids hidden blocked work under generic statuses.", ["Add BLOCKED status"], "COULD", "MEDIUM"),

      finalizeItem("DASHBOARD_KPIS", "Health mapping confirmation", "Ensure KPI categories map to agreed lifecycle semantics.", "ACTIVE=On Track, AT_RISK=At Risk, BEHIND=Behind.", "Prevents reporting disputes with stakeholders.", ["Add composite health score"], "MUST", "HIGH"),
      finalizeItem("DASHBOARD_KPIS", "AT_RISK threshold tuning", "Lock threshold for proactive intervention alerts.", "Suggested AT_RISK currently uses overdue-count heuristic.", "Prevents arbitrary escalation patterns.", ["Custom threshold by batch"], "SHOULD", "MEDIUM"),
      finalizeItem("DASHBOARD_KPIS", "Active student definition", "Align engagement metric with meaningful participation.", "Active students based on recent action updates.", "Avoids inflated engagement from passive logins.", ["Login-based metric", "Weighted activity metric"], "SHOULD", "MEDIUM"),
      finalizeItem("DASHBOARD_KPIS", "Pagination preferences", "Maintain readability for large project portfolios.", "Dashboard table paginates with 8 rows per page.", "Prevents scanning fatigue.", ["Configurable page size"], "COULD", "LOW"),

      finalizeItem("FILES", "Metadata-only vs real storage", "Clarify MVP boundary for document handling.", "Prototype stores file metadata only; no binary persistence.", "Prevents false assumptions about document retention.", ["External object storage integration"], "MUST", "HIGH"),
      finalizeItem("FILES", "Delete authority policy", "Define who can remove submitted artifacts.", "Delete flow not exposed in prototype.", "Prevents unauthorized data removal.", ["Supervisor-only deletion"], "SHOULD", "MEDIUM"),
      finalizeItem("FILES", "Archived project retention", "Define retention obligations for historical records.", "No explicit retention policy tied to ARCHIVED projects.", "Prevents compliance uncertainty.", ["Time-based retention"], "SHOULD", "MEDIUM"),

      finalizeItem("INTEGRATIONS", "Comms gating rule confirmation", "Ensure minimal operational readiness before activation.", "Comms integration must be CONNECTED for DRAFT to ACTIVE.", "Prevents unmanaged active projects.", ["Warn-only instead of block"], "MUST", "HIGH"),
      finalizeItem("INTEGRATIONS", "GitHub/Jira optionality", "Confirm which tools are optional vs mandatory.", "GitHub/Jira are optional and status-tracked.", "Prevents unnecessary go-live blockers.", ["Require Jira for all projects"], "SHOULD", "MEDIUM"),
      finalizeItem("INTEGRATIONS", "Validation depth for MVP", "Agree acceptable level of validation rigor at prototype stage.", "Validation is currently regex/format based only.", "Prevents overengineering in MVP or false trust in formats.", ["Ping-based connectivity checks"], "COULD", "LOW"),
      finalizeItem("INTEGRATIONS", "Configuration scope decision", "Clarify whether integrations are project-level or supervisor-level defaults.", "Current model stores integration setup per project.", "Prevents migration complexity later.", ["Supervisor-level template + project override"], "SHOULD", "MEDIUM"),

      finalizeItem("REPORTING_EXPORT", "Export scope and report content", "Define minimum dataset for stakeholder reporting.", "No dedicated reporting export yet; audit + tracking data exists.", "Prevents ad-hoc report generation mismatches.", ["Project summary-only export", "Full audit export"], "MUST", "HIGH"),
      finalizeItem("REPORTING_EXPORT", "Export format requirements", "Identify required deliverable formats for client operations.", "Prototype can export checklist data as JSON/text (new module).", "Prevents late-stage reporting rework.", ["Add printable/PDF format"], "SHOULD", "MEDIUM"),
      finalizeItem("REPORTING_EXPORT", "Export authority constraints", "Ensure report distribution aligns with governance.", "Intended supervisor-led exports in current supervision model.", "Prevents unapproved sharing of sensitive supervision records.", ["Student read-only export subset"], "SHOULD", "MEDIUM")
    ];
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
      }),
      seedProject("p_11", "Research Paper Assistant", {
        offset: 11,
        lifecycleStatus: "AT_RISK",
        studentIds: ["u_stu_1", "u_stu_6"],
        commsLink: "https://teams.microsoft.com/l/channel/mock-research",
        githubUrl: "https://github.com/demo-org/research-assistant",
        jiraProjectKey: "RPA",
        jiraBoardLink: "https://jira.example.com/boards/111",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(12),
        commitsWeek: 3,
        openIssues: 6,
        jiraTodo: 5,
        jiraInProgress: 2,
        jiraDone: 4,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 22)]
      }),
      seedProject("p_12", "Scholarship Eligibility Checker", {
        offset: 12,
        lifecycleStatus: "ACTIVE",
        studentIds: ["u_stu_4", "u_stu_2"],
        commsLink: "https://meet.google.com/mock-scholarship",
        githubUrl: "https://github.com/demo-org/scholarship-checker",
        jiraProjectKey: "SCH",
        jiraBoardLink: "https://jira.example.com/boards/112",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(18),
        commitsWeek: 8,
        openIssues: 2,
        jiraTodo: 2,
        jiraInProgress: 1,
        jiraDone: 9,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 19)]
      }),
      seedProject("p_13", "Exam Hall Scheduler", {
        offset: 13,
        lifecycleStatus: "BEHIND",
        studentIds: ["u_stu_3", "u_stu_5"],
        commsLink: "https://chat.whatsapp.com/mock-examhall",
        githubUrl: "https://github.com/demo-org/exam-hall-scheduler",
        jiraProjectKey: "EXH",
        jiraBoardLink: "https://jira.example.com/boards/113",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(-3),
        commitsWeek: 2,
        openIssues: 9,
        jiraTodo: 6,
        jiraInProgress: 2,
        jiraDone: 2,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 30), audit("STATUS_CHANGED", "u_sup", { fromStatus: "AT_RISK", toStatus: "BEHIND" }, 4)]
      }),
      seedProject("p_14", "Hostel Maintenance Tracker", {
        offset: 14,
        lifecycleStatus: "ACTIVE",
        studentIds: ["u_stu_6", "u_stu_1"],
        commsLink: "https://discord.com/channels/mock-hostel",
        githubUrl: "",
        jiraProjectKey: "",
        jiraBoardLink: "",
        githubStatus: "NOT_CONFIGURED",
        jiraStatus: "NOT_CONFIGURED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(25),
        commitsWeek: 1,
        openIssues: 0,
        jiraTodo: 0,
        jiraInProgress: 0,
        jiraDone: 1,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 8)]
      }),
      seedProject("p_15", "University Event Ops Console", {
        offset: 15,
        lifecycleStatus: "DRAFT",
        studentIds: ["u_stu_2", "u_stu_5"],
        commsLink: "https://zoom.us/j/1122334455",
        githubUrl: "https://github.com/demo-org/event-ops-console",
        jiraProjectKey: "EVC",
        jiraBoardLink: "https://jira.example.com/boards/115",
        githubStatus: "CONNECTED",
        jiraStatus: "CONNECTED",
        commsStatus: "CONNECTED",
        milestoneDate: dateOffsetOnly(31),
        commitsWeek: 0,
        openIssues: 1,
        jiraTodo: 1,
        jiraInProgress: 0,
        jiraDone: 0,
        auditEvents: [audit("PROJECT_CREATED", "u_sup", { lifecycleStatus: "DRAFT" }, 3)]
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
    generateSeedData: generateSeedData,
    generateFinalizeSeedItems: generateFinalizeSeedItems
  };
})();
