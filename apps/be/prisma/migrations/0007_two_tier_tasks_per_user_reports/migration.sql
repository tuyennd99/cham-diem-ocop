-- ponytail: DB reset/reseed is approved; this migration intentionally drops the obsolete Subtask tier.
ALTER TABLE "report_workspaces" DROP CONSTRAINT IF EXISTS "report_workspaces_subtaskId_fkey";
ALTER TABLE "report_workspaces" DROP CONSTRAINT IF EXISTS "report_workspaces_reportingSubtaskId_fkey";
DROP TABLE IF EXISTS "subtasks";
DROP TABLE IF EXISTS "reporting_subtasks";
DROP TYPE IF EXISTS "SubtaskStatus";

ALTER TABLE "programs"
  ADD COLUMN "assigningOrganizationId" INTEGER NOT NULL,
  ADD COLUMN "leadOrganizationId" INTEGER NOT NULL;
ALTER TABLE "programs"
  ADD CONSTRAINT "programs_assigningOrganizationId_fkey"
    FOREIGN KEY ("assigningOrganizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "programs_leadOrganizationId_fkey"
    FOREIGN KEY ("leadOrganizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "programs_assigningOrganizationId_idx" ON "programs"("assigningOrganizationId");
CREATE INDEX "programs_leadOrganizationId_idx" ON "programs"("leadOrganizationId");

ALTER TABLE "task_collaborators" DROP CONSTRAINT IF EXISTS "task_collaborators_taskId_fkey";
ALTER TABLE "task_collaborators" RENAME COLUMN "taskId" TO "programId";
ALTER TABLE "task_collaborators" RENAME TO "program_collaborators";
ALTER INDEX IF EXISTS "task_collaborators_pkey" RENAME TO "program_collaborators_pkey";
ALTER INDEX IF EXISTS "task_collaborators_taskId_organizationId_key"
  RENAME TO "program_collaborators_programId_organizationId_key";
ALTER TABLE "program_collaborators"
  ADD CONSTRAINT "program_collaborators_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_assigningOrganizationId_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_leadOrganizationId_fkey";
DROP INDEX IF EXISTS "tasks_leadOrganizationId_idx";
ALTER TABLE "tasks"
  DROP COLUMN "assigningOrganizationId",
  DROP COLUMN "leadOrganizationId",
  DROP COLUMN IF EXISTS "frequency";
ALTER TABLE "tasks" RENAME COLUMN "subtaskicStartAt" TO "startAt";
DROP TYPE IF EXISTS "Frequency";

DROP INDEX IF EXISTS "report_workspaces_subtaskId_kind_ownerOrganizationId_key";
DROP INDEX IF EXISTS "report_workspaces_reportingSubtaskId_kind_ownerOrganizationId_key";
DROP INDEX IF EXISTS "report_workspaces_taskId_kind_ownerOrganizationId_key";
DROP INDEX IF EXISTS "report_workspaces_one_consolidated_per_subtask";
ALTER TABLE "report_workspaces"
  DROP COLUMN IF EXISTS "subtaskId",
  DROP COLUMN IF EXISTS "reportingSubtaskId",
  ADD COLUMN IF NOT EXISTS "taskId" INTEGER,
  ALTER COLUMN "taskId" SET NOT NULL,
  ADD COLUMN "ownerUserId" INTEGER;
ALTER TABLE "report_workspaces"
  ADD CONSTRAINT "report_workspaces_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "report_workspaces_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "report_workspaces_kind_ownerUserId_check"
    CHECK (("kind" = 'PROGRESS' AND "ownerUserId" IS NOT NULL) OR ("kind" = 'CONSOLIDATED' AND "ownerUserId" IS NULL));
CREATE INDEX "report_workspaces_taskId_kind_idx" ON "report_workspaces"("taskId", "kind");
CREATE INDEX "report_workspaces_ownerUserId_idx" ON "report_workspaces"("ownerUserId");
CREATE UNIQUE INDEX "report_workspaces_progress_task_user_key"
  ON "report_workspaces"("taskId", "ownerUserId") WHERE "kind" = 'PROGRESS';
CREATE UNIQUE INDEX "report_workspaces_consolidated_task_key"
  ON "report_workspaces"("taskId") WHERE "kind" = 'CONSOLIDATED';
