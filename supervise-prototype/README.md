# SuperviseSuite Prototype (Frontend-Only)

## Run
- Option A: Open `supervise-prototype/index.html` directly in a browser.
- Option B: Run a static server from repo root:
  - `npx serve supervise-prototype`
  - or `cd supervise-prototype && python -m http.server 8000`

## Demo Accounts
All accounts use password: `demo123`

- Supervisor: `supervisor@demo.com`
- Students:
  - `student1@demo.com`
  - `student2@demo.com`
  - `student3@demo.com`
  - `student4@demo.com`
  - `student5@demo.com`
  - `student6@demo.com`

## Implemented
- Hash routing:
  - `#/login`
  - `#/dashboard`
  - `#/projects`
  - `#/projects/new`
  - `#/projects/:id`
  - `#/student`
- Role-based auth simulation (`SUPERVISOR`, `STUDENT`) with route protection.
- LocalStorage-backed data layer with first-load seed data.
- Supervisor dashboard with:
  - Summary metrics
  - Project health table with quick actions
  - Activity trend charts (canvas via vanilla JS)
  - Skeleton loading + integration warning states
- Projects list with search and filters.
- 2-step project creation wizard.
- Project detail tabs:
  - Overview
  - Activity
  - Meetings (add/view)
  - Action Items (status updates, Jira actions)
  - Files (metadata upload + simulated download)
- Student home with assigned projects, due-soon action items, and recent meetings.
- Toast notifications and modal dialogs.

## Simulated
- GitHub and Jira integrations (configured/not configured states, mocked analytics).
- Jira task creation and linking (mock issue key/url generation/storage).
- File downloads (toast-based simulation).
- API latency/loading behavior via Promise + `setTimeout`.

## Notes
- No backend, no frameworks, no build tools.
- Charts implemented in `assets/js/charts.js` using HTML canvas (no CDN dependency).
