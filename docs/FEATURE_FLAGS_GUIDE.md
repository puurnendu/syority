# Feature Flags Guide

## Overview

Aurianoa OS uses a layered feature flag system for progressive rollout and per-tenant control.

## Architecture

```
Global Flag (FeatureFlag)
  ↓
Tenant Override (TenantFeature)
  ↓
M7.6G Enhanced: Scope, Rollout %, Environment, Expiry, Dependencies
```

## Flag Resolution Order

1. Check if flag exists → if not, disabled
2. Check if flag has expired (`expires_at` < now) → disabled
3. Check dependencies → if any dependency disabled → this flag disabled
4. Check environment filter → must match current env
5. Check scope:
   - `global` → use `isEnabled` directly
   - `organization` → check tenant override
   - `role` → check if user role matches
   - `user` → check if specific user enabled
   - `environment` → check env match
6. Check rollout percentage → hash(userId + flagKey) < percentage

## Scopes

| Scope | Description |
|-------|-------------|
| `global` | On/off for everyone |
| `organization` | Per-tenant override |
| `role` | Enable for specific roles |
| `user` | Enable for specific users |
| `environment` | Enable for specific environment |

## Environments

| Value | Description |
|-------|-------------|
| `all` | All environments |
| `production` | Production only |
| `beta` | Beta environments |
| `development` | Dev/staging only |

## API

```
GET  /api/admin/features          — List all flags with registry
POST /api/admin/features          — Create flag
PATCH /api/admin/features/[id]    — Toggle/update
```

## Admin UI

Platform → Feature Flags (`/platform/features`)

Features:
- Toggle global enable/disable
- Per-tenant overrides
- Scope selector
- Rollout percentage slider
- Expiry date picker
- Environment filter
- Dependency picker
