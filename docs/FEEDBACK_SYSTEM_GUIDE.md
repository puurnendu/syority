# Beta Feedback System Guide

## Overview

The feedback system (M7.6G) enables beta users to submit bugs, improvements, feature requests, and questions directly from the application. Every submission auto-captures environment context.

## User Experience

A floating 💬 button appears on every page. Clicking it opens a feedback panel:

1. **Select type**: Bug 🐛 | Improvement 💡 | Feature Request ✨ | Question ❓ | General 💬
2. **Title**: Brief summary (max 200 chars)
3. **Description**: Detailed explanation (max 5000 chars)
4. **Severity** (bugs only): Low | Medium | High | Critical

### Auto-Captured Context

Every submission automatically includes:
- Current route (URL path)
- Detected module (from route)
- Browser user agent
- Operating system
- Screen resolution
- App version
- Git commit hash

## Feedback Lifecycle

```
open → acknowledged → in_progress → resolved → closed
                                  → wont_fix
```

## API

### User API
```
GET  /api/feedback — Own feedback
POST /api/feedback — Submit feedback
```

### Admin API
```
GET   /api/admin/feedback — All feedback (filterable)
PATCH /api/admin/feedback — Update status/assignment
```

### Filters
- `type` — bug, improvement, feature_request, question, general
- `status` — open, acknowledged, in_progress, resolved, closed, wont_fix
- `severity` — low, medium, high, critical
- `page`, `limit` — pagination

## Admin Management

Platform admins manage feedback through the Beta Management console (`/platform/beta`), which shows:
- Open feedback count
- Feedback by type/severity
- Assignment tracking
- Resolution tracking
