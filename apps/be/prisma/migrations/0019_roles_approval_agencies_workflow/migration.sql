-- AlterEnum ProductStatus & EvaluationStatus
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'EXCLUDED';

-- CreateEnum ProductPublicationState
CREATE TYPE "ProductPublicationState" AS ENUM ('UNPUBLISHED', 'PUBLISHED', 'UPDATING');

-- AlterTable users: add roles array
ALTER TABLE "users"
  ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY['REGISTRANT']::"Role"[];

UPDATE "users"
SET "roles" = CASE
  WHEN "role" = 'REGISTRANT' THEN ARRAY['REGISTRANT']::"Role"[]
  ELSE (
    SELECT COALESCE(array_agg(r::"Role"), ARRAY["role"]::"Role"[])
    FROM (
      SELECT DISTINCT unnest(
        (CASE WHEN 'MANAGE' = ANY("staffPermissions") OR "role" = 'ADMIN' THEN ARRAY['ADMIN']::text[] ELSE ARRAY[]::text[] END) ||
        (CASE WHEN 'VIEW' = ANY("staffPermissions") OR "role" = 'VIEWER' THEN ARRAY['VIEWER']::text[] ELSE ARRAY[]::text[] END) ||
        (CASE WHEN 'SCORE' = ANY("staffPermissions") OR "role" = 'JUDGE' THEN ARRAY['JUDGE']::text[] ELSE ARRAY[]::text[] END)
      ) AS r
    ) sub
  )
END;

-- CreateTable managing_agencies
CREATE TABLE "managing_agencies" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "managing_agencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "managing_agencies_code_key" ON "managing_agencies"("code");
CREATE UNIQUE INDEX "managing_agencies_name_key" ON "managing_agencies"("name");

-- CreateTable product_category_agencies
CREATE TABLE "product_category_agencies" (
    "categoryId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_category_agencies_pkey" PRIMARY KEY ("categoryId", "agencyId")
);
CREATE INDEX "product_category_agencies_agencyId_idx" ON "product_category_agencies"("agencyId");
ALTER TABLE "product_category_agencies"
  ADD CONSTRAINT "product_category_agencies_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_category_agencies"
  ADD CONSTRAINT "product_category_agencies_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "managing_agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable organization_units: add managingAgencyId
ALTER TABLE "organization_units"
  ADD COLUMN "managingAgencyId" TEXT;
CREATE INDEX "organization_units_managingAgencyId_idx" ON "organization_units"("managingAgencyId");
ALTER TABLE "organization_units"
  ADD CONSTRAINT "organization_units_managingAgencyId_fkey"
  FOREIGN KEY ("managingAgencyId") REFERENCES "managing_agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed 4 official Managing Agencies from Decision 26/2026/QĐ-TTg Appendix I
INSERT INTO "managing_agencies" ("id", "code", "name", "order", "isActive", "updatedAt") VALUES
  ('agency-bnnmt', 'BNNMT', 'Bộ Nông nghiệp và Môi trường', 1, true, CURRENT_TIMESTAMP),
  ('agency-bct', 'BCT', 'Bộ Công Thương', 2, true, CURRENT_TIMESTAMP),
  ('agency-byt', 'BYT', 'Bộ Y tế', 3, true, CURRENT_TIMESTAMP),
  ('agency-bvhttdl', 'BVHTTDL', 'Bộ Văn hóa, Thể thao và Du lịch', 4, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "order" = EXCLUDED."order",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Link existing organization units by matching code if present
UPDATE "organization_units" SET "managingAgencyId" = 'agency-bnnmt' WHERE "code" IN ('SNNMT', 'BNNMT') AND "managingAgencyId" IS NULL;
UPDATE "organization_units" SET "managingAgencyId" = 'agency-bct' WHERE "code" IN ('SCT', 'BCT') AND "managingAgencyId" IS NULL;
UPDATE "organization_units" SET "managingAgencyId" = 'agency-byt' WHERE "code" IN ('SYT', 'BYT') AND "managingAgencyId" IS NULL;
UPDATE "organization_units" SET "managingAgencyId" = 'agency-bvhttdl' WHERE "code" IN ('SVHTTDL', 'BVHTTDL') AND "managingAgencyId" IS NULL;

-- Seed initial category -> managing agency links according to Decision 26/2026/QĐ-TTg Appendix I
INSERT INTO "product_category_agencies" ("categoryId", "agencyId")
SELECT v."categoryId", v."agencyId"
FROM (VALUES
  ('fresh-produce', 'agency-bnnmt'),
  ('fresh-animal-products', 'agency-bnnmt'),
  ('processed-grains', 'agency-bnnmt'),
  ('honey-and-other-agri-food', 'agency-bnnmt'),
  ('ready-to-eat', 'agency-bct'),
  ('grain-products', 'agency-bnnmt'),
  ('grain-products', 'agency-bct'),
  ('processed-produce', 'agency-bnnmt'),
  ('processed-animal-and-agri-food', 'agency-bnnmt'),
  ('processed-animal-and-agri-food', 'agency-bct'),
  ('liquid-condiments', 'agency-bnnmt'),
  ('other-condiments', 'agency-bnnmt'),
  ('tea', 'agency-bnnmt'),
  ('herbal-tea', 'agency-bnnmt'),
  ('coffee-cocoa', 'agency-bnnmt'),
  ('white-liquor', 'agency-bct'),
  ('other-alcoholic-drinks', 'agency-bct'),
  ('bottled-water', 'agency-byt'),
  ('other-non-alcoholic-drinks', 'agency-bct'),
  ('herbal-functional-products', 'agency-byt'),
  ('herbal-cosmetics', 'agency-byt'),
  ('essential-oils-and-herbs', 'agency-byt'),
  ('essential-oils-and-herbs', 'agency-bct'),
  ('handicraft', 'agency-bct'),
  ('handicraft', 'agency-bnnmt'),
  ('textiles-apparel', 'agency-bct'),
  ('flowers', 'agency-bnnmt'),
  ('ornamental-plants', 'agency-bnnmt'),
  ('ornamental-animals', 'agency-bnnmt'),
  ('community-ecotourism', 'agency-bvhttdl'),
  ('community-ecotourism', 'agency-bnnmt')
) AS v("categoryId", "agencyId")
INNER JOIN "product_categories" c ON c."id" = v."categoryId"
ON CONFLICT ("categoryId", "agencyId") DO NOTHING;

-- AlterTable products: approval, return, requiredAgencySnapshot, publication
ALTER TABLE "products"
  ADD COLUMN "approvedAt" TIMESTAMPTZ(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "returnedAt" TIMESTAMPTZ(3),
  ADD COLUMN "returnedById" TEXT,
  ADD COLUMN "returnReason" VARCHAR(1000),
  ADD COLUMN "requiredAgencySnapshot" JSONB,
  ADD COLUMN "publicationState" "ProductPublicationState" NOT NULL DEFAULT 'UNPUBLISHED',
  ADD COLUMN "publishedFinalScore" DOUBLE PRECISION,
  ADD COLUMN "publishedStarRating" INTEGER,
  ADD COLUMN "publishedAt" TIMESTAMPTZ(3),
  ADD COLUMN "publishedById" TEXT;

ALTER TABLE "products"
  ADD CONSTRAINT "products_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products"
  ADD CONSTRAINT "products_returnedById_fkey"
  FOREIGN KEY ("returnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products"
  ADD CONSTRAINT "products_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable product_judge_assignments
CREATE TABLE "product_judge_assignments" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "managingAgencyId" TEXT,
    "organizationUnitId" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "mustSubmitToComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "removedAt" TIMESTAMPTZ(3),
    "removedById" TEXT,
    "removeReason" VARCHAR(255),
    CONSTRAINT "product_judge_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_judge_assignments_productId_judgeId_key" ON "product_judge_assignments"("productId", "judgeId");
CREATE INDEX "product_judge_assignments_productId_isActive_idx" ON "product_judge_assignments"("productId", "isActive");
CREATE INDEX "product_judge_assignments_judgeId_isActive_idx" ON "product_judge_assignments"("judgeId", "isActive");

ALTER TABLE "product_judge_assignments"
  ADD CONSTRAINT "product_judge_assignments_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_judge_assignments"
  ADD CONSTRAINT "product_judge_assignments_judgeId_fkey"
  FOREIGN KEY ("judgeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_judge_assignments"
  ADD CONSTRAINT "product_judge_assignments_managingAgencyId_fkey"
  FOREIGN KEY ("managingAgencyId") REFERENCES "managing_agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_judge_assignments"
  ADD CONSTRAINT "product_judge_assignments_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_judge_assignments"
  ADD CONSTRAINT "product_judge_assignments_removedById_fkey"
  FOREIGN KEY ("removedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable product_result_history
CREATE TABLE "product_result_history" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "finalScore" DOUBLE PRECISION,
    "starRating" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "actorId" TEXT,
    "reason" VARCHAR(255),
    "snapshot" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_result_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_result_history_productId_createdAt_idx" ON "product_result_history"("productId", "createdAt");
ALTER TABLE "product_result_history"
  ADD CONSTRAINT "product_result_history_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_result_history"
  ADD CONSTRAINT "product_result_history_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable evaluations: add reopen/exclude tracking
ALTER TABLE "evaluations"
  ADD COLUMN "previousStatus" "EvaluationStatus",
  ADD COLUMN "reopenedAt" TIMESTAMPTZ(3),
  ADD COLUMN "reopenedById" TEXT,
  ADD COLUMN "reopenReason" VARCHAR(255),
  ADD COLUMN "excludedAt" TIMESTAMPTZ(3),
  ADD COLUMN "excludedById" TEXT,
  ADD COLUMN "excludeReason" VARCHAR(255);

-- CreateTable evaluation_history_events
CREATE TABLE "evaluation_history_events" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "fromStatus" "EvaluationStatus",
    "toStatus" "EvaluationStatus" NOT NULL,
    "actorId" TEXT,
    "reason" VARCHAR(255),
    "previousTotal" INTEGER,
    "snapshot" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluation_history_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "evaluation_history_events_evaluationId_createdAt_idx" ON "evaluation_history_events"("evaluationId", "createdAt");
ALTER TABLE "evaluation_history_events"
  ADD CONSTRAINT "evaluation_history_events_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation_history_events"
  ADD CONSTRAINT "evaluation_history_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
