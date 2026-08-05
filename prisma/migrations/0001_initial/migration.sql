-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('DOT_XUAT', 'DINH_KY');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('PROGRESS', 'CONSOLIDATED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "SubtaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE
    "organizations" (
        "id" SERIAL NOT NULL,
        "code" VARCHAR(50) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "isAssigningAuthority" BOOLEAN NOT NULL DEFAULT false,
        "isExecutingUnit" BOOLEAN NOT NULL DEFAULT true,
        "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ (3) NOT NULL,
        CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "users" (
        "id" SERIAL NOT NULL,
        "username" VARCHAR(100) NOT NULL,
        "fullName" VARCHAR(255) NOT NULL,
        "position" VARCHAR(255),
        "rank" VARCHAR(255),
        "phone" VARCHAR(30),
        "passwordHash" VARCHAR(255) NOT NULL,
        "organizationId" INTEGER NOT NULL,
        "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
        "lockedAt" TIMESTAMPTZ (3),
        "lockedUntil" TIMESTAMPTZ (3),
        "lockReason" VARCHAR(500),
        "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
        "failedLoginWindowStartedAt" TIMESTAMPTZ (3),
        "deletedAt" TIMESTAMPTZ (3),
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ (3) NOT NULL,
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "permission_groups" (
        "id" SERIAL NOT NULL,
        "code" VARCHAR(100) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ (3) NOT NULL,
        CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "permissions" (
        "id" SERIAL NOT NULL,
        "code" VARCHAR(100) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "permission_group_permissions" (
        "permissionGroupId" INTEGER NOT NULL,
        "permissionId" INTEGER NOT NULL,
        CONSTRAINT "permission_group_permissions_pkey" PRIMARY KEY ("permissionGroupId", "permissionId")
    );

-- CreateTable
CREATE TABLE
    "user_permission_groups" (
        "userId" INTEGER NOT NULL,
        "permissionGroupId" INTEGER NOT NULL,
        CONSTRAINT "user_permission_groups_pkey" PRIMARY KEY ("userId", "permissionGroupId")
    );

-- CreateTable
CREATE TABLE
    "programs" (
        "id" SERIAL NOT NULL,
        "code" VARCHAR(50) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ (3) NOT NULL,
        CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "tasks" (
        "id" SERIAL NOT NULL,
        "code" VARCHAR(100) NOT NULL,
        "name" VARCHAR(500) NOT NULL,
        "description" TEXT,
        "expectedOutput" TEXT,
        "type" "TaskType" NOT NULL,
        "programId" INTEGER NOT NULL,
        "assigningOrganizationId" INTEGER NOT NULL,
        "leadOrganizationId" INTEGER NOT NULL,
        "dueAt" TIMESTAMPTZ (3),
        "frequency" "Frequency",
        "subtaskicStartAt" TIMESTAMPTZ (3),
        "closedAt" TIMESTAMPTZ (3),
        "closedById" INTEGER,
        "closeReason" TEXT,
        "completedAt" TIMESTAMPTZ (3),
        "completedById" INTEGER,
        "deletedAt" TIMESTAMPTZ (3),
        "createdById" INTEGER NOT NULL,
        "updatedById" INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ (3) NOT NULL,
        CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "task_collaborators" (
        "id" SERIAL NOT NULL,
        "taskId" INTEGER NOT NULL,
        "organizationId" INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "task_collaborators_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "reporting_subtasks" (
        "id" SERIAL NOT NULL,
        "taskId" INTEGER NOT NULL,
        "frequency" "Frequency",
        "year" INTEGER NOT NULL,
        "sequence" INTEGER NOT NULL,
        "subtaskStartAt" TIMESTAMPTZ (3) NOT NULL,
        "dueAt" TIMESTAMPTZ (3) NOT NULL,
        "status" "SubtaskStatus" NOT NULL DEFAULT 'OPEN',
        "completedAt" TIMESTAMPTZ (3),
        "canceledAt" TIMESTAMPTZ (3),
        "cancelReason" TEXT,
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "reporting_subtasks_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "report_workspaces" (
        "id" SERIAL NOT NULL,
        "kind" "ReportKind" NOT NULL,
        "reportingSubtaskId" INTEGER NOT NULL,
        "ownerOrganizationId" INTEGER NOT NULL,
        "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
        "content" TEXT,
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ (3) NOT NULL,
        CONSTRAINT "report_workspaces_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "report_versions" (
        "id" SERIAL NOT NULL,
        "workspaceId" INTEGER NOT NULL,
        "versionNumber" INTEGER NOT NULL,
        "content" TEXT,
        "submittedById" INTEGER NOT NULL,
        "submittedAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
        "reviewedById" INTEGER,
        "reviewedAt" TIMESTAMPTZ (3),
        "rejectionReason" TEXT,
        CONSTRAINT "report_versions_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "stored_files" (
        "id" SERIAL NOT NULL,
        "originalName" VARCHAR(500) NOT NULL,
        "storageKey" VARCHAR(500) NOT NULL,
        "mimeType" VARCHAR(255) NOT NULL,
        "sizeBytes" INTEGER NOT NULL,
        "checksum" VARCHAR(128) NOT NULL,
        "uploadedById" INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "draft_attachments" (
        "workspaceId" INTEGER NOT NULL,
        "storedFileId" INTEGER NOT NULL,
        CONSTRAINT "draft_attachments_pkey" PRIMARY KEY ("workspaceId", "storedFileId")
    );

-- CreateTable
CREATE TABLE
    "version_attachments" (
        "reportVersionId" INTEGER NOT NULL,
        "storedFileId" INTEGER NOT NULL,
        CONSTRAINT "version_attachments_pkey" PRIMARY KEY ("reportVersionId", "storedFileId")
    );

-- CreateTable
CREATE TABLE
    "notifications" (
        "id" SERIAL NOT NULL,
        "recipientId" INTEGER NOT NULL,
        "eventKey" VARCHAR(255) NOT NULL,
        "type" VARCHAR(100) NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "body" TEXT,
        "entityType" VARCHAR(100),
        "entityId" INTEGER,
        "readAt" TIMESTAMPTZ (3),
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "audit_logs" (
        "id" SERIAL NOT NULL,
        "actorId" INTEGER,
        "organizationId" INTEGER,
        "action" VARCHAR(100) NOT NULL,
        "entityType" VARCHAR(100) NOT NULL,
        "entityId" INTEGER,
        "beforeData" JSONB,
        "afterData" JSONB,
        "reason" TEXT,
        "ipAddress" VARCHAR(64),
        "userAgent" TEXT,
        "requestId" VARCHAR(100),
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "refresh_sessions" (
        "id" SERIAL NOT NULL,
        "userId" INTEGER NOT NULL,
        "tokenHash" VARCHAR(255) NOT NULL,
        "expiresAt" TIMESTAMPTZ (3) NOT NULL,
        "revokedAt" TIMESTAMPTZ (3),
        "createdAt" TIMESTAMPTZ (3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
    );

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations" ("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users" ("username");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users" ("organizationId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users" ("status");

-- CreateIndex
CREATE UNIQUE INDEX "permission_groups_code_key" ON "permission_groups" ("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions" ("code");

-- CreateIndex
CREATE UNIQUE INDEX "programs_code_key" ON "programs" ("code");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_code_key" ON "tasks" ("code");

-- CreateIndex
CREATE INDEX "tasks_programId_idx" ON "tasks" ("programId");

-- CreateIndex
CREATE INDEX "tasks_leadOrganizationId_idx" ON "tasks" ("leadOrganizationId");

-- CreateIndex
CREATE INDEX "tasks_deletedAt_idx" ON "tasks" ("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "task_collaborators_taskId_organizationId_key" ON "task_collaborators" ("taskId", "organizationId");

-- CreateIndex
CREATE INDEX "reporting_subtasks_taskId_status_idx" ON "reporting_subtasks" ("taskId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_subtasks_taskId_subtaskStartAt_dueAt_key" ON "reporting_subtasks" ("taskId", "subtaskStartAt", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "report_workspaces_reportingSubtaskId_kind_ownerOrganizationI_key" ON "report_workspaces" (
    "reportingSubtaskId",
    "kind",
    "ownerOrganizationId"
);

-- CreateIndex
CREATE UNIQUE INDEX "report_versions_workspaceId_versionNumber_key" ON "report_versions" ("workspaceId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storageKey_key" ON "stored_files" ("storageKey");

-- CreateIndex
CREATE INDEX "notifications_recipientId_readAt_idx" ON "notifications" ("recipientId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipientId_eventKey_key" ON "notifications" ("recipientId", "eventKey");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs" ("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs" ("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_tokenHash_key" ON "refresh_sessions" ("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_sessions_userId_expiresAt_idx" ON "refresh_sessions" ("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_permissions" ADD CONSTRAINT "permission_group_permissions_permissionGroupId_fkey" FOREIGN KEY ("permissionGroupId") REFERENCES "permission_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_permissions" ADD CONSTRAINT "permission_group_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_groups" ADD CONSTRAINT "user_permission_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_groups" ADD CONSTRAINT "user_permission_groups_permissionGroupId_fkey" FOREIGN KEY ("permissionGroupId") REFERENCES "permission_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigningOrganizationId_fkey" FOREIGN KEY ("assigningOrganizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_leadOrganizationId_fkey" FOREIGN KEY ("leadOrganizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_subtasks" ADD CONSTRAINT "reporting_subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_workspaces" ADD CONSTRAINT "report_workspaces_reportingSubtaskId_fkey" FOREIGN KEY ("reportingSubtaskId") REFERENCES "reporting_subtasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_workspaces" ADD CONSTRAINT "report_workspaces_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "report_workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_attachments" ADD CONSTRAINT "draft_attachments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "report_workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_attachments" ADD CONSTRAINT "draft_attachments_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "stored_files" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_attachments" ADD CONSTRAINT "version_attachments_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "report_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_attachments" ADD CONSTRAINT "version_attachments_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "stored_files" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure a reporting subtask has at most one consolidated workspace.
CREATE UNIQUE INDEX "report_workspaces_one_consolidated_per_subtask" ON "report_workspaces" ("reportingSubtaskId")
WHERE
    "kind" = 'CONSOLIDATED';

-- Submitted history is immutable; drafts belong only to workspaces.
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_status_not_draft_check" CHECK ("status" <> 'DRAFT');