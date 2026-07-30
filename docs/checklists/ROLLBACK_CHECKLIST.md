# Rollback Checklist

## Decision
- [ ] Severity of issue confirmed (P1/P2/P3)
- [ ] Rollback approved by stakeholder
- [ ] Communication sent to affected users

## Pre-Rollback
- [ ] Current database state backed up
- [ ] Current container image tag recorded
- [ ] Active user sessions documented
- [ ] Queue state captured (pending jobs)

## Rollback Steps
- [ ] Stop application containers: `docker compose stop`
- [ ] Restore database from pre-deployment backup
- [ ] Switch to previous container image tag
- [ ] Start application: `docker compose up -d`
- [ ] Verify health: `GET /api/health`

## Post-Rollback Verification
- [ ] All health checks passing
- [ ] Login works
- [ ] Platform dashboard loads
- [ ] Tenant access works
- [ ] Workpack CRUD operational
- [ ] Reports generating
- [ ] Notifications delivering
- [ ] BullMQ workers running

## Incident Response
- [ ] Root cause analysis initiated
- [ ] Incident report created
- [ ] Fix timeline communicated
- [ ] Follow-up deployment scheduled
