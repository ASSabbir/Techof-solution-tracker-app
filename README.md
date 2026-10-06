# TechOf Solution Tracker

Internal web app for a small team: **tasks → deadlines → accountability → attendance → leaderboard**.
Built from *TechOf Solution Tracker SRS v1.0*.

**Stack:** Next.js 14 (App Router) · React 18 · Tailwind CSS · GSAP · TanStack Query · React Hook Form + Zod · react-icons
**API:** Express.js (Node) · MongoDB (Mongoose) · JWT · bcrypt · Zod · node-cron

## Quick start

Requirements: Node.js 18.18+ and a MongoDB instance.

```bash
# 1. install everything (root npm workspace installs server + client)
npm install

# 2. MongoDB – pick one
docker compose up -d                       # local MongoDB on :27017
#   or edit server/.env and set MONGODB_URI to your MongoDB Atlas URL

# 3. create the three users (+ optional realistic demo data)
npm run seed:demo                          # or: npm run seed   (users only)

# 4. run API (http://localhost:5000) and web app (http://localhost:3000)
npm run dev
```

Sign in with username `sabbir`, `billah` or `noman` — password **`TechOf@2026`**
(change it in Profile → Security, or set `SEED_PASSWORD` in `server/.env` before seeding).

`server/.env` and `client/.env.local` are pre-filled for local development. For production set a long random
`JWT_SECRET`, `CLIENT_URL` (the web app origin) and `NEXT_PUBLIC_API_URL` (the API URL, ending in `/api`).
Production run: `npm run build && npm start`.

## What's inside (SRS coverage)

| Area | Highlights |
|---|---|
| Auth | Email/username login, show/hide password, remember session, bcrypt hashing, JWT, login rate limiting, logout invalidates tokens (token version), automatic session validation |
| Dashboard | Greeting, personal summary, quick actions, today's attendance with live duration, team status (Active / Away / Overdue task / Not active), approvals inbox, recent activity, team performance |
| Tasks | Create/assign (hours, days or custom deadline), priorities, live server-synced countdown, complete with confirmation, green completed state, overdue state with "overdue by", My Tasks tabs (All/Active/Due Soon/Completed/Overdue/Extended), Team Tasks table, search + filters, pagination, task detail with full timeline |
| Extensions | Request extra time with a reason; the assigner approves/rejects (never your own); original deadline is never lost; multiple extensions; configurable max count/duration; optional auto-approve |
| Anti-cheating | Original deadline, creator, assignee and history fields are immutable; history records can't be deleted; activity log is append-only; all timestamps come from the server; statuses only change through validated transitions; countdowns use server time |
| Leaderboard | Points by priority, multipliers for on-time / within extension / late, early-finish bonus, on-time rate, completion rate, extra time used, achievements; 7-day / 30-day / all-time |
| Attendance | Clock in/out (duplicate prevention), Present / Late / Absent / Leave, month calendar with colours + day detail, history, team view, stats, scheduled job marks missing working days Absent |
| Leave | Apply, approve/reject by teammates, reason stays visible, approved leave appears in attendance, conflict handling with explicit override |
| Notifications | Task assigned, reminders (1h / 30m / 10m), overdue, extension requested/approved/rejected, completed, leave events; bell with unread count + toasts |
| Profile & Settings | Photo upload, display name, password change, stats & achievements; theme (dark/light/system), reduce motion, team settings (extension rules, workday hours, working days, scoring) |
| UI | Premium dark/light dashboard, GSAP: animated login, staggered page entrances, page transitions, modal open/close, sidebar + drawer, notification dropdown, animated leaderboard bars & counters, count-ups, completion burst, countdown state-change pulses. Fully responsive. |

Defaults you may want to change in **Settings**: timezone `Asia/Dhaka`, working days Sat–Thu, late after 09:15, workday ends 18:00.

## Project layout

```
server/  src/{config,controllers,middleware,models,routes,services,utils,validators,jobs}  server.js
client/  app/(login, dashboard, tasks, leaderboard, attendance, leave, activity, profile, settings)  components/  hooks/  lib/
```

API groups: `/api/auth`, `/api/users`, `/api/tasks`, `/api/extensions` (alias `/api/task-extensions`), `/api/attendance`,
`/api/leave`, `/api/leaderboard`, `/api/notifications`, `/api/activity`, `/api/settings`, `/api/dashboard`.

## Notes & design decisions

- **JavaScript, not TypeScript:** both apps run without a build step on the API side. Backend models/services are structured so they can be migrated to TS later.
- **Extension timing:** an approved extension adds time to the *later* of the current deadline and the approval moment, so approving an already-overdue task still gives real working time. The original deadline is always preserved.
- **Self-assigned tasks:** the assigner approves extensions; if you assigned a task to yourself, any teammate can approve it.
- **Attendance rate** = (present + late) ÷ (present + late + absent); leave days are excluded.
- **Scores are snapshots:** changing scoring settings never rewrites points already awarded.
- **PENDING status** exists in the data model for future scheduled starts; v1 tasks start `ACTIVE` immediately.
- Tokens are sent as `Authorization: Bearer` and stored in the browser (localStorage, or sessionStorage if "Remember" is off). Move to httpOnly cookies if you expose this publicly.
- Future-ready: `projectId` on tasks and a reserved `role` field on users for Projects / roles later.
