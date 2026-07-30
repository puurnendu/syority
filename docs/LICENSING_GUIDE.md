# Licensing Guide

## Overview

Aurianoa OS uses a formal licensing engine (M7.6G) to control feature access, resource limits, and usage quotas per organization. Each organization has exactly **one license**.

## License Types

| Type | Users | Shutdowns | Projects | Storage | Description |
|------|-------|-----------|----------|---------|-------------|
| Trial | 5 | 1 | 2 | 2 GB | 14-day trial |
| Beta | 15 | 5 | 10 | 10 GB | Beta testing program |
| Starter | 10 | 3 | 5 | 5 GB | Small teams |
| Professional | 50 | 10 | 25 | 50 GB | Mid-size organizations |
| Enterprise | 200 | 50 | 100 | 200 GB | Large organizations |
| Unlimited | ∞ | ∞ | ∞ | ∞ | Strategic accounts |
| Custom | Varies | Varies | Varies | Varies | Custom limits |

## License Lifecycle

```
active → grace → expired
active → suspended
active → revoked
```

- **Active**: Normal operation
- **Grace**: Past expiry date but within grace period (default: 14 days)
- **Expired**: Past grace period — restricted access
- **Suspended**: Manually suspended by platform admin
- **Revoked**: Permanently revoked

## License Numbers

Format: `SYO-XXXX-XXXX` (uppercase alphanumeric, excluding O/0/I/1)

## Resource Limits

Each license controls:

| Resource | Default (Beta) |
|----------|---------------|
| Users | 15 |
| Shutdowns | 5 |
| Projects | 10 |
| Storage | 10 GB |
| Documents | 500 |
| Reports | 100 |
| Dashboards | 20 |
| Scheduled Reports | 10 |
| AI Credits | 1,000 |
| API Calls/Day | 10,000 |
| Background Jobs/Day | 500 |
| Emails/Month | 1,000 |

## API

- `GET /api/admin/licenses` — List all licenses
- `POST /api/admin/licenses` — Create license
- `GET /api/admin/licenses/[id]` — License details + usage
- `PATCH /api/admin/licenses/[id]` — Update limits/status

## Service

```typescript
import { licenseService } from '@/core/platform/LicenseService';

// Create license
await licenseService.createLicense({
  organizationId: '...',
  licenseType: 'beta',
  expiresAt: new Date('2027-01-01'),
});

// Check limit
const result = await licenseService.checkLimit(orgId, 'max_users');
if (!result.allowed) {
  // User limit reached
}

// Enforce expiry (run daily)
await licenseService.enforceExpiry();
```
