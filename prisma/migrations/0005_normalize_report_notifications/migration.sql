UPDATE "notifications"
SET "type" = CASE "type"
  WHEN 'BAO_CAO_GUI' THEN 'REPORT_SUBMITTED'
  WHEN 'BAO_CAO_DUYET' THEN 'REPORT_APPROVED'
  WHEN 'BAO_CAO_TRA' THEN 'REPORT_REJECTED'
END
WHERE "type" IN ('BAO_CAO_GUI', 'BAO_CAO_DUYET', 'BAO_CAO_TRA');

UPDATE "notifications" AS notification
SET "entityType" = 'Task',
    "entityId" = period."taskId"
FROM "report_versions" AS version
JOIN "report_workspaces" AS workspace
  ON workspace."id" = version."workspaceId"
JOIN "reporting_periods" AS period
  ON period."id" = workspace."reportingPeriodId"
WHERE notification."entityType" = 'ReportVersion'
  AND notification."entityId" = version."id"
  AND notification."type" IN (
    'REPORT_SUBMITTED',
    'REPORT_APPROVED',
    'REPORT_REJECTED'
  );
