BEGIN;

-- CreateEnum
CREATE TYPE "StaffPermission" AS ENUM ('MANAGE', 'VIEW', 'SCORE');

-- CreateEnum
CREATE TYPE "LocalityType" AS ENUM ('COMMUNE', 'WARD');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VIEWER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organizationUnitId" TEXT,
ADD COLUMN     "staffPermissions" "StaffPermission"[] NOT NULL DEFAULT ARRAY[]::"StaffPermission"[];

-- AlterTable
ALTER TABLE "product_categories" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "criteria_sets" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourceHash" VARCHAR(64),
ADD COLUMN     "version" VARCHAR(50) NOT NULL DEFAULT '1';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "completedAt" TIMESTAMPTZ(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "localityCodeAtSubmit" VARCHAR(50),
ADD COLUMN     "localityId" TEXT,
ADD COLUMN     "localityNameAtSubmit" VARCHAR(255),
ADD COLUMN     "localityTypeAtSubmit" "LocalityType",
ADD COLUMN     "provinceNameAtSubmit" VARCHAR(255);

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "submissionSnapshot" JSONB,
ADD COLUMN     "submittedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "organization_units" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_groups" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localities" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "LocalityType" NOT NULL,
    "provinceName" VARCHAR(255) NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3),
    "effectiveTo" TIMESTAMPTZ(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "localities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_status_events" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromStatus" "ProductStatus",
    "toStatus" "ProductStatus" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "actorId" TEXT,
    "reason" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_units_code_key" ON "organization_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "product_groups_code_key" ON "product_groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "localities_code_key" ON "localities"("code");

-- CreateIndex
CREATE INDEX "product_status_events_createdAt_idx" ON "product_status_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_status_events_productId_sequence_key" ON "product_status_events"("productId", "sequence");

-- Preserve legacy staff capabilities; no unit or locality is inferred.
UPDATE "users" SET "staffPermissions" = CASE "role"::text
  WHEN 'ADMIN' THEN ARRAY['MANAGE', 'VIEW']::"StaffPermission"[]
  WHEN 'JUDGE' THEN ARRAY['SCORE']::"StaffPermission"[]
  ELSE ARRAY[]::"StaffPermission"[] END;

-- Official group labels come from the committed category catalog.
INSERT INTO "product_groups" ("id", "code", "name", "order", "updatedAt") VALUES
('product-group-DRINK', 'DRINK', 'Sản phẩm đồ uống', 1, CURRENT_TIMESTAMP),
('product-group-FOOD', 'FOOD', 'Sản phẩm thực phẩm', 2, CURRENT_TIMESTAMP),
('product-group-HANDICRAFT', 'HANDICRAFT', 'Sản phẩm hàng thủ công mỹ nghệ', 3, CURRENT_TIMESTAMP),
('product-group-HERBAL', 'HERBAL', 'Sản phẩm dược liệu và sản phẩm từ dược liệu', 4, CURRENT_TIMESTAMP),
('product-group-ORNAMENTAL', 'ORNAMENTAL', 'Sản phẩm sinh vật cảnh', 5, CURRENT_TIMESTAMP),
('product-group-TOURISM', 'TOURISM', 'Sản phẩm dịch vụ du lịch cộng đồng, du lịch sinh thái và điểm du lịch', 6, CURRENT_TIMESTAMP);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "product_categories" c
    LEFT JOIN "product_groups" g ON g."code" = c."groupCode"
    WHERE g."id" IS NULL OR g."name" <> c."groupName"
  ) THEN
    RAISE EXCEPTION '0011 cannot map existing categories to the six official group codes/names; no rows were deleted';
  END IF;
END $$;
UPDATE "product_categories" c SET "groupId" = g."id"
FROM "product_groups" g WHERE g."code" = c."groupCode";
ALTER TABLE "product_categories" ALTER COLUMN "groupId" SET NOT NULL;

-- Unknown historical versions/times remain explicit; current labels are not proof
-- of the labels or assignment scope at submission.
UPDATE "criteria_sets" SET "version" = 'legacy';
UPDATE "evaluations" e SET "submissionSnapshot" = jsonb_build_object(
  'schemaVersion', 1, 'provenance', 'PRE_UPGRADE',
  'historicalValuesVerified', false, 'submittedAt', NULL, 'total', e."total",
  'judge', jsonb_build_object('id', u."id", 'fullName', u."fullName", 'organizationUnit', NULL),
  'product', jsonb_build_object('id', p."id", 'categoryId', p."categoryId"),
  'criteriaSet', jsonb_build_object('id', cs."id", 'name', cs."name", 'source', cs."source", 'version', NULL, 'sourceHash', NULL),
  'scope', jsonb_build_object('criterionIds', COALESCE((
    SELECT jsonb_agg(ids."criterionId" ORDER BY ids."criterionId") FROM (
      SELECT DISTINCT sc."criterionId" FROM "scores" s
      JOIN "sub_criteria" sc ON sc."id" = s."subCriterionId"
      WHERE s."evaluationId" = e."id"
    ) ids
  ), '[]'::jsonb)),
  'scores', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'subCriterionId', s."subCriterionId", 'optionId', s."optionId", 'note', s."note", 'points', o."points",
      'criterion', jsonb_build_object('id', c."id", 'code', c."code", 'name', c."name", 'maxScore', c."maxScore", 'sectionCode', c."sectionCode", 'sectionName', c."sectionName"),
      'subCriterion', jsonb_build_object('code', sc."code", 'content', sc."content"),
      'option', jsonb_build_object('label', o."label", 'points', o."points")
    ) ORDER BY c."order", sc."order", s."subCriterionId")
    FROM "scores" s JOIN "sub_criteria" sc ON sc."id" = s."subCriterionId"
    JOIN "criteria" c ON c."id" = sc."criterionId"
    JOIN "score_options" o ON o."id" = s."optionId"
    WHERE s."evaluationId" = e."id"
  ), '[]'::jsonb)
)
FROM "users" u, "products" p LEFT JOIN "criteria_sets" cs ON cs."categoryId" = p."categoryId"
WHERE e."judgeId" = u."id" AND e."productId" = p."id" AND e."status" = 'SUBMITTED';

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "product_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "localities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_status_events" ADD CONSTRAINT "product_status_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_status_events" ADD CONSTRAINT "product_status_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
