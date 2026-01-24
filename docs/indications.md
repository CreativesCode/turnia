# Turnia — Product & Tech Specification (SPA + Capacitor)

## 1) Overview
**Turnia** is a web application for hospitals/clinics to manage **on-call shifts (“turnos de guardia”)** with clear **roles, permissions, traceability (audit log)** and a workflow for **requesting / offering / swapping shifts**.  
Primary goal: replace Excel/WhatsApp workflows with a secure, auditable, role-based system that works on desktop (admin) and mobile (staff).

Target market: **Chile** (B2B hospitals/clinics).  
Primary platform: **SPA (web)** + **Capacitor** to ship **native mobile apps**.

---

## 2) Platforms & UX
### 2.1 Web (SPA)
- Admin users primarily operate on desktop.
- Core UI: calendar + list views + filters.
- Must be fast and responsive.

### 2.2 Mobile (Capacitor)
- Native wrappers for iOS/Android.
- Focused on:
  - viewing shifts (personal + team)
  - requesting changes / swaps
  - receiving **push notifications**
- Uses the same SPA bundle (shared UI) adapted for mobile screens.

---

## 3) Core Concepts (Domain)
### Entities
- **Organization (Org)**: hospital/clinic client.
- **Team / Service (Team)**: e.g. UCI, Urgencias, Pabellón.
- **User / Profile**: staff member.
- **Membership**: user’s role in an org and optionally in a team.
- **Shift**: scheduled guard shift (day/night/24h/etc), assigned or unassigned.
- **Shift Request**: request to give away / take / swap / cover a shift.
- **Availability events**: vacation, sick leave, training, etc. (blocks assignment).
- **Audit Log**: immutable log of actions.

### Shift Types (examples)
- Day
- Night
- 24h
- Custom (configurable per org)

---

## 4) Roles & Permission Model (RBAC + scoped to Org/Team)
Turnia supports roles that can be assigned:
- at **Org scope** (covers all teams), and/or
- at **Team scope** (only for one service).

### 4.1 Roles
1) **Superadmin / Platform Admin**
   - Manages tenants (orgs), billing, system settings.
   - Not involved in hospital operational scheduling.

2) **Org Admin**
   - Manages org settings, teams, role assignments.
   - Can access all teams in the org.

3) **Team Manager (Scheduler / Jefatura / Coordinador)**
   - Manages scheduling for one or more teams.
   - Creates/edits shift plans and approves requests.
   - Has full visibility for those teams.

4) **User (Staff)**
   - Views:
     - own shifts
     - team shifts (visibility rules apply)
   - Creates shift requests:
     - give away shift
     - request coverage
     - swap with teammate
     - offer to take open shifts (if allowed)
   - Cannot directly modify final schedule without approval (unless configured).

5) **Viewer (Read-only)**
   - Reads schedules and reports; no edits.

### 4.2 Permission Principles (must-haves)
- **Least privilege**: users see only what they should see.
- **Scoped membership**: a user may be Manager in Team A and User in Team B.
- **Auditability**: all schedule-impacting actions are logged.
- **Configurable org policy**:
  - Can users see all team shifts or only published views?
  - Can users self-assign open shifts or always require approval?

---

## 5) Functional Requirements

## 5.1 Organization & Team Setup
- Create org (tenant).
- Create teams/services under org.
- Configure:
  - shift types (day/night/24h)
  - default rules (rest windows, fairness, etc.) — see section 5.5
- Invite users and assign roles (Org Admin / Team Manager / User / Viewer).

## 5.2 Scheduling (Admin/Manager)
### Create & Maintain Schedules
- Create shifts for a date range (weekly/monthly planning).
- Assign staff to shifts.
- Edit shift details:
  - time window
  - type
  - location/team
  - assigned user
- Publish schedule (optional “draft vs published” states).

### Views
- Calendar view (month/week/day)
- List view (filters by team, type, user, date)

### Controls
- Bulk operations:
  - generate shifts from templates
  - copy week/month patterns
  - bulk assign/unassign
- Conflict warnings:
  - overlapping shifts
  - blocked availability (vacation/sick leave)

## 5.3 Staff Experience (Users)
### Schedule Visibility
- “My shifts” view (calendar + list).
- “Team schedule” view (calendar + list).
- Fast lookup: “Who is on-call now?” for a team (optional kiosk mode).

### Request Flows (critical)
1) **Give Away / Coverage Request**
   - User selects one of their shifts → “Request coverage”
   - The shift becomes “pending coverage” (depending on policy)
   - Team members can volunteer to take it (if allowed)
   - Manager approves final assignment

2) **Swap Request**
   - User selects their shift → proposes swap with another user and/or another shift
   - Target user accepts/declines
   - Manager approves final swap (recommended default)

3) **Offer to Take Open Shift**
   - Users can see open shifts (if enabled)
   - Submit “I can take it”
   - Manager approves assignment

### Request States
- Draft (optional)
- Submitted
- Accepted by counterparty (for swaps)
- Approved / Rejected by Manager
- Cancelled (with rules)

## 5.4 Approvals (Admin/Manager)
- Unified “Requests inbox”
- For each request:
  - see details and impact
  - approve/reject with comment
- Approval writes:
  - shift reassignment changes
  - audit log record
  - notifications to involved users

## 5.5 Rules / Constraints (MVP vs Next)
**MVP must support at least:**
- Prevent obvious invalid assignments (overlap).
- Respect blocked availability (vacation/sick leave) if recorded.
- Optional configurable minimal rest rule:
  - e.g. cannot assign if end-to-start rest < X hours.

**Recommended differentiators (phase 2):**
- Fairness counters:
  - nights/weekends per user
- Hard constraints:
  - limit consecutive nights
  - maximum weekly hours
- Skill/competency tags:
  - ensure coverage by qualified staff

## 5.6 Audit & Traceability (must-have)
- Immutable audit log for:
  - shift created/edited/deleted
  - assignment changes
  - request lifecycle actions (submit/accept/approve/reject/cancel)
  - role/permission changes
- Each record includes:
  - actor, timestamp
  - entity + before/after snapshot (or diff)
  - reason/comment (when relevant)

## 5.7 Notifications
- Push notifications on mobile (via Capacitor integration).
- Email fallback.
- Trigger events:
  - request submitted
  - request accepted/declined
  - request approved/rejected
  - shift assigned/changed
  - schedule published

## 5.8 Reporting / Export
- Export schedule by team/date range:
  - Excel / CSV (minimum)
  - PDF (optional)
- Basic metrics (optional MVP):
  - count of shifts per user (by type)
  - nights/weekends distribution (phase 2)

---

## 6) Suggested Tech Stack (SPA + Capacitor)
### Frontend
- **Next.js** (SPA-style navigation; can be deployed as a single-page app experience)
- UI: calendar component + role-gated routes
- Capacitor wrapper for native builds:
  - push notifications
  - deep links (optional)
  - secure storage for tokens (optional)

### Backend (Supabase-first)
- **Supabase Auth** for authentication
- **PostgreSQL** as main database
- **RLS (Row Level Security)** for permission enforcement
- **Realtime** for live request updates
- **Edge Functions** (TypeScript) for privileged operations:
  - approve requests
  - apply multi-table transactions safely
  - send notifications
  - generate exports (optional)

---

## 7) Security Requirements
- All sensitive operations enforced server-side via:
  - RLS policies
  - RPC/Edge Functions for privileged workflows
- No reliance on frontend-only permission checks.
- Audit log must not be editable by standard users.
- Tenant isolation:
  - users from Org A must never see Org B data.

---

## 8) MVP Scope (Sellable)
### Must-have
- Multi-tenant orgs + teams
- Roles: Org Admin, Team Manager, User, Viewer
- Shift creation + assignment + calendar views
- Requests: give away/coverage + swap + manager approval
- Audit log
- Push/email notifications
- Export CSV

### Nice-to-have (post-MVP)
- Advanced scheduling optimization
- Fairness scoring & constraint engine
- Integrations with HR systems
- SSO

---

## 9) Success Criteria (Product)
- Admin can build and publish a monthly schedule without external tools.
- Staff can request swaps/coverage from mobile in < 30 seconds.
- Every schedule change is traceable (who/what/when/why).
- Supports pilot deployment per service (e.g., Urgencias) and then org-wide expansion.
