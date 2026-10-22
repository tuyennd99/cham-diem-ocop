UPDATE "notifications"
SET
  "type" = CASE "type"
    WHEN 'BAO_CAO_GUI' THEN 'REPORT_SUBMITTED'
    WHEN 'BAO_CAO_DUYET' THEN 'REPORT_APPROVED'
    WHEN 'BAO_CAO_TRA' THEN 'REPORT_REJECTED'
    WHEN 'GIAO_NHIEM_VU' THEN 'GIAO'
    WHEN 'KY_BAO_CAO_MOI' THEN 'SUBTASK_OPENED'
    WHEN 'NHIEM_VU_DONG' THEN 'TASK_CLOSED'
  END
WHERE
  "type" IN (
    'BAO_CAO_GUI',
    'BAO_CAO_DUYET',
    'BAO_CAO_TRA',
    'GIAO_NHIEM_VU',
    'KY_BAO_CAO_MOI',
    'NHIEM_VU_DONG'
  );

UPDATE "notifications" AS notification
SET
  "entityType" = 'Task',
  "entityId" = subtask."taskId"
FROM
  "report_versions" AS version
  JOIN "report_workspaces" AS workspace ON workspace."id" = version."workspaceId"
  JOIN "reporting_subtasks" AS subtask ON subtask."id" = workspace."reportingSubtaskId"
WHERE
  notification."entityType" = 'ReportVersion'
  AND notification."entityId" = version."id"
  AND notification."type" IN (
    'REPORT_SUBMITTED',
    'REPORT_APPROVED',
    'REPORT_REJECTED'
  );