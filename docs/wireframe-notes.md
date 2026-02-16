# Wireframe Notes

## Layout Shell
- Left fixed sidebar with role-based navigation.
- Top bar with global search and profile/logout.
- Card-and-table content style inspired by Moodle dashboard layouts.

## Login (`#/login`)
- Demo account quick buttons and manual email/password login.
- Session stored in localStorage.

## Supervisor Dashboard (`#/dashboard`)
- Summary metrics cards (project totals, health states, student activity, overdue items).
- Main project health table with status, activity, commits, Jira counts, milestones, quick actions.
- Activity trend chart and compact comparison chart.
- Skeleton loading and integration warning row for non-configured projects.

## Projects List (`#/projects`)
- Search + status + integration filters.
- Supervisor-only "New Project" CTA.
- Project cards with health and integration indicators.

## Create Wizard (`#/projects/new`)
- Step 1: title, batch, semester, milestone, student assignment.
- Step 2: communication link, GitHub URL, Jira key, Jira board.
- Validation for required fields and quick progression.

## Project Detail (`#/projects/:id`)
Tabs:
- Overview: metadata, member list, communication CTA, integration state, connect modal.
- Activity: commits trend, student contribution table, Jira summary or empty state.
- Meetings: meeting list, detail modal, add-meeting modal with dynamic action items.
- Action Items: editable statuses, create Jira task, link existing Jira.
- Files: metadata-only upload simulation and download simulation.

## Student Home (`#/student`)
- Assigned projects list only.
- Personal due-soon action items and recent meetings.
- Supervisor controls hidden.

## Access Rules
- Not logged in -> forced to login.
- Student blocked from supervisor-only routes.
- Students can only open assigned project details.
