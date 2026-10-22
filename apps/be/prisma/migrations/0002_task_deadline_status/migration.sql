-- CreateEnum
CREATE TYPE "TaskDeadlineStatus" AS ENUM (
    'DANG_THUC_HIEN',
    'SAP_DEN_HAN',
    'HOAN_THANH_DUNG_HAN',
    'HOAN_THANH_QUA_HAN',
    'QUA_HAN'
);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "deadlineStatus" "TaskDeadlineStatus";

-- Backfill the current status of active ad-hoc tasks.
UPDATE "tasks"
SET "deadlineStatus" = CASE
    WHEN "completedAt" IS NOT NULL AND "completedAt" <= "dueAt"
        THEN 'HOAN_THANH_DUNG_HAN'::"TaskDeadlineStatus"
    WHEN "completedAt" IS NOT NULL
        THEN 'HOAN_THANH_QUA_HAN'::"TaskDeadlineStatus"
    WHEN CURRENT_TIMESTAMP > "dueAt"
        THEN 'QUA_HAN'::"TaskDeadlineStatus"
    WHEN "dueAt" <= CURRENT_TIMESTAMP + INTERVAL '5 days'
        THEN 'SAP_DEN_HAN'::"TaskDeadlineStatus"
    ELSE 'DANG_THUC_HIEN'::"TaskDeadlineStatus"
END
WHERE "type" = 'DOT_XUAT'
  AND "deletedAt" IS NULL
  AND "dueAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "tasks_type_deadlineStatus_idx" ON "tasks"("type", "deadlineStatus");
