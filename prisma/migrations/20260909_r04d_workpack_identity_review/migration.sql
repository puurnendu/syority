-- R0.4-D — dedicated Workpack identity review disposition.
-- Does not change Workpack.status. Does not assign Event. Does not delete Workpacks.
-- Rollback: DROP TABLE "workpack_identity_reviews";

CREATE TABLE "workpack_identity_reviews" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "review_state" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "classification" TEXT,
    "confirmed_event_id" UUID,
    "previous_event_id" UUID,
    "reason" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "reviewer_id" UUID,
    "approver_id" UUID,
    "conflict_accepted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workpack_identity_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workpack_identity_reviews_workpack_id_key" ON "workpack_identity_reviews"("workpack_id");
CREATE INDEX "workpack_identity_reviews_organization_id_review_state_idx" ON "workpack_identity_reviews"("organization_id", "review_state");

ALTER TABLE "workpack_identity_reviews"
    ADD CONSTRAINT "workpack_identity_reviews_workpack_id_fkey"
    FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
