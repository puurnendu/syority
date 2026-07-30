# Smoke Test Checklist

## Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (verify error)
- [ ] Session persistence after page refresh
- [ ] Role-based navigation (admin sees admin links)

## Platform Administration
- [ ] Dashboard loads with correct counts
- [ ] License Management — CRUD operations
- [ ] Module Management — toggle modules per org
- [ ] Feature Flags — toggle, create, per-tenant override
- [ ] Diagnostics — all components show status
- [ ] Analytics — DAU/MAU loads
- [ ] Beta Management — beta orgs listed
- [ ] Release Info — version/commit displayed
- [ ] Tenant Management — list, create, edit
- [ ] User Management — list, create, edit

## Tenant Features
- [ ] Digital Plant loads
- [ ] Asset Register loads
- [ ] Engineering Issues loads
- [ ] Shutdown Scope loads
- [ ] Planner Workspace loads
- [ ] Workpack CRUD operations
- [ ] Report generation
- [ ] OIS dashboards load
- [ ] Business Rules Engine loads

## Notifications
- [ ] In-app notifications delivered
- [ ] Notification bell shows count
- [ ] Mark as read works

## Feedback
- [ ] Floating feedback button visible
- [ ] Submit bug report
- [ ] Submit feature request
- [ ] View own feedback
- [ ] Admin can see all feedback

## Reports
- [ ] Generate PDF report
- [ ] Schedule report delivery
- [ ] Report preview works

## API Health
- [ ] `GET /api/health` → 200
- [ ] `GET /api/health/ready` → 200
- [ ] `GET /api/health/live` → 200
- [ ] `GET /api/admin/diagnostics` → full report
