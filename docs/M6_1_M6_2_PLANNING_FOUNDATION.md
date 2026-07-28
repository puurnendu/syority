# M6.1–M6.2 Planning Foundation

## Scope

Planner Core only — **no execution modules**.

1. **Project / Event refinement** — multi-shutdown (parent/child), calendar, WBS (existing), discipline, status, milestones  
2. **Enterprise Workpack Template Library** — Platform / Tenant / Knowledge, Draft / Published / Deprecated, family + revision, clone / compare / instantiate

## Schema

Migration: `prisma/migrations/20260726190000_planning_foundation/`

- `events`: `parent_event_id`, `description`, `calendar_id`, `discipline_id`
- `event_milestones`
- `workpack_templates`: family/revision/lifecycle/library_scope + section JSON columns
- `workpack_template_logic_links`

## APIs

| Path | Purpose |
|------|---------|
| `GET/POST /api/events` | List (enriched) / create with calendar & discipline |
| `GET/POST/DELETE /api/events/[id]/milestones` | Milestones |
| `GET/POST /api/planning/templates` | Library list / create draft |
| `GET/PUT /api/planning/templates/[id]` | Detail / update draft |
| `POST .../publish\|deprecate\|version\|clone\|instantiate` | Lifecycle |
| `POST /api/planning/templates/compare` | Section diff |

## UI / Nav

- `/planning/templates` — library browser  
- `/planning/templates/new` — create draft  
- `/planning/templates/[id]` — 10-section viewer + actions  
- `/planning/templates/[id]/instantiate` — Create Workpack wizard  
- Events list shows discipline, calendar, milestones, WBS, child shutdowns  
- Event create / edit: status, calendar, discipline, parent event (multi-shutdown)  
- Event detail: planning fields + milestones CRUD  

## Instantiation

Published template → `POST .../instantiate` → new Workpack + activities copied; template unchanged; section snapshot in `equipment_technical_data`.

## Tests

```bash
npx vitest run src/core/planning/__tests__/planningFoundation.test.ts
```

## Docker

```bash
# apply migration
docker compose run --rm -e DATABASE_URL=postgresql://user:pass@db:5432/syority migrator npx prisma migrate deploy
# or psql the migration SQL
docker compose build app && docker compose up -d app
```
