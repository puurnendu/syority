# Development Baseline Protection Rules

These rules govern all engineering workflows following the M7.9.4 Baseline Freeze.

---

## Core Rules

1.  **M7.9.4 is the Stable Baseline:** The current state represents the verified, frozen production foundation.
2.  **No Unintentional Regression:** New development must not modify baseline behavior unintentionally.
3.  **Milestone-Scoped Features:** All new features must be planned and developed under dedicated, scoped milestones.
4.  **Database Migration Reviews:** All database schema changes (`prisma/migrations` or `schema.prisma`) require explicit review and backward-compatibility verification.
5.  **Prisma Schema Integrity:** Do not introduce unindexed foreign keys, un-aliased models, or missing required UUID/timestamp defaults without client synchronization.
6.  **Zero CRUD Regressions:** Core business shutdown lifecycle workflows (Org → Site → Plant → Area → Unit → System → Asset → Event → Activities → Schedule → Workpack → Materials → QA/QC → Safety → Reports → Dashboard) must maintain 100% pass status.
7.  **Absolute Tenant Isolation:** Tenant boundary checks and IDOR protections must never regress or leak data across organizations.
8.  **Strict RBAC Enforcement:** Role-based access control must be validated on both UI navigation visibility and backend API route guards.
9.  **Mandatory Regression Testing:** Every new development milestone must execute the baseline regression test suite before merging or tagging.
10. **No Mass Mechanical Refactoring:** Do not perform broad search-and-replace or speculative rewrites across the codebase without a dedicated architectural audit.
11. **No Type-Suppression Shortcuts:** Do not use `(prisma as any)` or arbitrary type casts to hide genuine schema mismatches.
12. **Preserve Working Logic:** Do not modify working functionality merely to remove static technical-debt warnings unless specifically assigned.
