-- AlterTable: nullable first so the 2 existing task rows survive
ALTER TABLE "tasks" ADD COLUMN "assigningOrganizationId" INTEGER;
ALTER TABLE "tasks" ADD COLUMN "leadOrganizationId" INTEGER;

-- Backfill each task from the program it belongs to
UPDATE "tasks" t
SET "assigningOrganizationId" = p."assigningOrganizationId",
    "leadOrganizationId"      = p."leadOrganizationId"
FROM "programs" p
WHERE p."id" = t."programId";

-- Enforce once every row has a value
ALTER TABLE "tasks" ALTER COLUMN "assigningOrganizationId" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "leadOrganizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE
    "task_collaborators" (
        "id" SERIAL NOT NULL,
        "taskId" INTEGER NOT NULL,
        "organizationId" INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "task_collaborators_pkey" PRIMARY KEY ("id")
    );

-- CreateIndex (must exist before the ON CONFLICT backfill below)
CREATE UNIQUE INDEX "task_collaborators_taskId_organizationId_key" ON "task_collaborators" ("taskId", "organizationId");

CREATE INDEX "tasks_assigningOrganizationId_idx" ON "tasks" ("assigningOrganizationId");

CREATE INDEX "tasks_leadOrganizationId_idx" ON "tasks" ("leadOrganizationId");

-- Backfill collaborators from the parent program's collaborators
INSERT INTO "task_collaborators" ("taskId", "organizationId", "createdAt")
SELECT t."id", pc."organizationId", CURRENT_TIMESTAMP
FROM "tasks" t
JOIN "program_collaborators" pc ON pc."programId" = t."programId"
ON CONFLICT ("taskId", "organizationId") DO NOTHING;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigningOrganizationId_fkey" FOREIGN KEY ("assigningOrganizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_leadOrganizationId_fkey" FOREIGN KEY ("leadOrganizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
