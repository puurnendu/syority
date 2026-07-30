# Tenant Provisioning Checklist

## Pre-Provisioning
- [ ] Organization name and slug confirmed
- [ ] License type selected (trial/beta/starter/professional/enterprise)
- [ ] Admin user details collected (name, email, role)
- [ ] Site information gathered (if applicable)

## Organization Setup
- [ ] Organization created via Platform Admin or API
- [ ] License issued: `POST /api/admin/licenses`
  - Verify license number generated (SYO-XXXX-XXXX)
  - Verify limits match selected tier
- [ ] Modules initialized: `POST /api/admin/modules` with `action: 'initialize'`
- [ ] Feature flags verified for this org
- [ ] Branding configured (logo, colors) — if custom

## User Setup
- [ ] Admin user created with `tenant_administrator` role
- [ ] Admin user login tested
- [ ] Additional users created (if required)
- [ ] User count within license limit

## Data Setup
- [ ] Sites created
- [ ] Plants/Areas/Units configured (if applicable)
- [ ] Activity codes configured
- [ ] Document templates uploaded (if applicable)

## Verification
- [ ] Tenant can log in
- [ ] Tenant sees correct modules based on license
- [ ] Tenant admin can manage users
- [ ] Workpack creation works
- [ ] Report generation works
- [ ] Notification delivery works
- [ ] Feedback button available

## Handoff
- [ ] Admin onboarding guide sent
- [ ] Planner onboarding guide sent (if applicable)
- [ ] Support contact shared
