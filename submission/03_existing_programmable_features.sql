/*
  Existing Unit 2 programmable features

  The database export already contains:
    - asset_readiness_view
    - get_failure_count
    - update_asset_status

  This file only verifies and invokes them. It does not drop or recreate
  routines/triggers and it does not insert test data.
*/

USE defence_asset_system;

SELECT *
FROM asset_readiness_view
ORDER BY AssetID;

SELECT get_failure_count(401) AS FailureCountForAsset401;

-- Read-only procedure verification is not possible for update_asset_status,
-- because the existing procedure performs an UPDATE. Review its definition
-- before manually invoking it in a disposable test database.
SHOW CREATE PROCEDURE update_asset_status;

-- Verify the legacy trigger is absent and the reviewed work-order/cost triggers
-- are installed only after the separate deployment migration has been applied.
SELECT TRIGGER_NAME
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
  AND TRIGGER_NAME IN (
    'trg_asset_repair_status',
    'trg_work_order_asset_unavailable_after_insert',
    'trg_work_order_asset_status_after_update',
    'trg_work_order_asset_status_after_delete',
    'trg_maintenance_event_require_cost_before_insert',
    'trg_maintenance_event_require_cost_before_update'
  )
ORDER BY TRIGGER_NAME;
-- Expected after migration 004: five reviewed triggers, no legacy repair trigger.
