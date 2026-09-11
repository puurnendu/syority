-- OD9.1 / Phase 7 — add the three missing ActivityStatus values.
--
-- schema.prisma declares eight ActivityStatus members; the physical enum has five.
-- 'released', 'verified' and 'closed' are the terminal execution states M12 writes, so
-- every RELEASE / VERIFY / CLOSE transition was attempting to store a value the type
-- could not represent.
--
-- Additive only: no existing value is removed or renamed, so no stored row changes
-- meaning and no data is rewritten. This is schema repair in support of M12; the M12
-- implementation itself is unchanged.
--
-- ADD VALUE IF NOT EXISTS keeps this re-runnable. Each statement is separate because a
-- new enum label is not visible to other statements inside the same transaction in
-- older PostgreSQL; keeping the dependent writes out of this migration entirely avoids
-- the visibility question.
ALTER TYPE "ActivityStatus" ADD VALUE IF NOT EXISTS 'released';
ALTER TYPE "ActivityStatus" ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE "ActivityStatus" ADD VALUE IF NOT EXISTS 'closed';
