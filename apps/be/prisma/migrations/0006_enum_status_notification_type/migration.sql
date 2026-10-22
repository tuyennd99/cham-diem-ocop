-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'GIAO_NHIEM_VU',
  'DONG_NHIEM_VU',
  'GUI_BAO_CAO',
  'DUYET_BAO_CAO',
  'TRA_BAO_CAO',
  'MO_KY_BAO_CAO',
  'QUA_HAN',
  'SAP_DEN_HAN'
);

-- AlterTable: organizations.status varchar -> EntityStatus
ALTER TABLE "organizations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "organizations"
  ALTER COLUMN "status" TYPE "EntityStatus" USING ("status"::"EntityStatus");
ALTER TABLE "organizations" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable: programs.status varchar -> EntityStatus
ALTER TABLE "programs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "programs"
  ALTER COLUMN "status" TYPE "EntityStatus" USING ("status"::"EntityStatus");
ALTER TABLE "programs" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable: notifications.type varchar -> NotificationType
-- Map current (English) values to the new Vietnamese enum members.
ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType" USING (
    CASE "type"
      WHEN 'GIAO' THEN 'GIAO_NHIEM_VU'
      WHEN 'TASK_CLOSED' THEN 'DONG_NHIEM_VU'
      WHEN 'REPORT_SUBMITTED' THEN 'GUI_BAO_CAO'
      WHEN 'REPORT_APPROVED' THEN 'DUYET_BAO_CAO'
      WHEN 'REPORT_REJECTED' THEN 'TRA_BAO_CAO'
      WHEN 'SUBTASK_OPENED' THEN 'MO_KY_BAO_CAO'
      WHEN 'QUA_HAN' THEN 'QUA_HAN'
      WHEN 'SAP_DEN_HAN' THEN 'SAP_DEN_HAN'
    END
  )::"NotificationType";
