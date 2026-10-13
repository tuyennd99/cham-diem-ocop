-- Approved replacement of the disposable task/report domain with OCOP data.
DROP TABLE IF EXISTS "version_attachments" CASCADE;
DROP TABLE IF EXISTS "draft_attachments" CASCADE;
DROP TABLE IF EXISTS "report_versions" CASCADE;
DROP TABLE IF EXISTS "report_workspaces" CASCADE;
DROP TABLE IF EXISTS "notifications" CASCADE;
DROP TABLE IF EXISTS "refresh_sessions" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "task_collaborators" CASCADE;
DROP TABLE IF EXISTS "program_collaborators" CASCADE;
DROP TABLE IF EXISTS "stored_files" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "programs" CASCADE;
DROP TABLE IF EXISTS "organizations" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

DROP TYPE IF EXISTS "TaskType" CASCADE;
DROP TYPE IF EXISTS "TaskDeadlineStatus" CASCADE;
DROP TYPE IF EXISTS "ReportKind" CASCADE;
DROP TYPE IF EXISTS "ReportStatus" CASCADE;
DROP TYPE IF EXISTS "UserStatus" CASCADE;
DROP TYPE IF EXISTS "NotificationType" CASCADE;
DROP TYPE IF EXISTS "EntityStatus" CASCADE;

CREATE TYPE "Role" AS ENUM ('REGISTRANT', 'JUDGE', 'ADMIN');
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'RESET_PASSWORD');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SCORING', 'COMPLETED');
CREATE TYPE "AttachmentType" AS ENUM ('IMAGE', 'EVIDENCE');
CREATE TYPE "EvaluationStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "role" "Role" NOT NULL DEFAULT 'REGISTRANT',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");

CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "otp_codes_attempts_check" CHECK ("attempts" >= 0)
);
CREATE INDEX "otp_codes_email_purpose_expiresAt_idx" ON "otp_codes"("email", "purpose", "expiresAt");
CREATE INDEX "otp_codes_userId_idx" ON "otp_codes"("userId");
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "groupCode" VARCHAR(50) NOT NULL,
    "groupName" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_categories_name_key" ON "product_categories"("name");
CREATE INDEX "product_categories_groupCode_name_idx" ON "product_categories"("groupCode", "name");

CREATE TABLE "criteria_sets" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" VARCHAR(255),
    "source" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "criteria_sets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "criteria_sets_categoryId_key" ON "criteria_sets"("categoryId");
ALTER TABLE "criteria_sets" ADD CONSTRAINT "criteria_sets_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "criteria" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "criteria_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "criteria_maxScore_check" CHECK ("maxScore" >= 0)
);
CREATE UNIQUE INDEX "criteria_setId_code_key" ON "criteria"("setId", "code");
CREATE UNIQUE INDEX "criteria_id_setId_key" ON "criteria"("id", "setId");
CREATE INDEX "criteria_setId_order_idx" ON "criteria"("setId", "order");
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_setId_fkey"
  FOREIGN KEY ("setId") REFERENCES "criteria_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sub_criteria" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "sub_criteria_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sub_criteria_criterionId_order_key" ON "sub_criteria"("criterionId", "order");
CREATE UNIQUE INDEX "sub_criteria_id_criterionId_key" ON "sub_criteria"("id", "criterionId");
CREATE INDEX "sub_criteria_criterionId_idx" ON "sub_criteria"("criterionId");
ALTER TABLE "sub_criteria" ADD CONSTRAINT "sub_criteria_criterionId_fkey"
  FOREIGN KEY ("criterionId") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "score_options" (
    "id" TEXT NOT NULL,
    "subCriterionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    CONSTRAINT "score_options_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "score_options_id_subCriterionId_key" ON "score_options"("id", "subCriterionId");
CREATE UNIQUE INDEX "score_options_subCriterionId_points_key" ON "score_options"("subCriterionId", "points");
CREATE INDEX "score_options_subCriterionId_idx" ON "score_options"("subCriterionId");
ALTER TABLE "score_options" ADD CONSTRAINT "score_options_subCriterionId_fkey"
  FOREIGN KEY ("subCriterionId") REFERENCES "sub_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "registrantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "formData" JSONB NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "finalScore" DOUBLE PRECISION,
    "starRating" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_finalScore_check" CHECK ("finalScore" IS NULL OR ("finalScore" >= 0 AND "finalScore" <= 100)),
    CONSTRAINT "products_starRating_check" CHECK ("starRating" IS NULL OR "starRating" BETWEEN 1 AND 5)
);
CREATE INDEX "products_status_categoryId_createdAt_idx" ON "products"("status", "categoryId", "createdAt");
CREATE INDEX "products_registrantId_createdAt_idx" ON "products"("registrantId", "createdAt");
ALTER TABLE "products" ADD CONSTRAINT "products_registrantId_fkey"
  FOREIGN KEY ("registrantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "fileName" VARCHAR(500) NOT NULL,
    "filePath" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attachments_productId_type_idx" ON "attachments"("productId", "type");
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "judge_assignments" (
    "judgeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "criterionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "judge_assignments_pkey" PRIMARY KEY ("judgeId", "categoryId")
);
CREATE INDEX "judge_assignments_categoryId_idx" ON "judge_assignments"("categoryId");
ALTER TABLE "judge_assignments" ADD CONSTRAINT "judge_assignments_judgeId_fkey"
  FOREIGN KEY ("judgeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "judge_assignments" ADD CONSTRAINT "judge_assignments_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "total" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evaluations_total_check" CHECK ("total" IS NULL OR "total" >= 0)
);
CREATE UNIQUE INDEX "evaluations_judgeId_productId_key" ON "evaluations"("judgeId", "productId");
CREATE INDEX "evaluations_productId_status_idx" ON "evaluations"("productId", "status");
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_judgeId_fkey"
  FOREIGN KEY ("judgeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "scores" (
    "evaluationId" TEXT NOT NULL,
    "subCriterionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "note" VARCHAR(2000),
    CONSTRAINT "scores_pkey" PRIMARY KEY ("evaluationId", "subCriterionId")
);
CREATE INDEX "scores_subCriterionId_idx" ON "scores"("subCriterionId");
ALTER TABLE "scores" ADD CONSTRAINT "scores_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scores" ADD CONSTRAINT "scores_subCriterionId_fkey"
  FOREIGN KEY ("subCriterionId") REFERENCES "sub_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scores" ADD CONSTRAINT "scores_optionId_subCriterionId_fkey"
  FOREIGN KEY ("optionId", "subCriterionId") REFERENCES "score_options"("id", "subCriterionId") ON DELETE RESTRICT ON UPDATE CASCADE;
