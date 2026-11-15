-- Add sequence-backed unique codeNumber to products while preserving all existing IDs, foreign keys, and historical rows
ALTER TABLE "products"
  ADD COLUMN "codeNumber" SERIAL;

-- Reassign sequential codeNumber to existing legacy rows ordered deterministically by createdAt ASC, id ASC
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC)::integer AS assigned_num
  FROM "products"
)
UPDATE "products" p
SET "codeNumber" = ordered.assigned_num
FROM ordered
WHERE p."id" = ordered."id";

-- Synchronize sequence so the next allocated number never collides with assigned rows or drops below already issued sequence values
DO $$
DECLARE
  seq_name text := pg_get_serial_sequence('products', 'codeNumber');
  max_assigned bigint;
  seq_last bigint;
  seq_called boolean;
  high_water bigint;
BEGIN
  SELECT COALESCE(MAX("codeNumber"), 0) INTO max_assigned FROM "products";
  EXECUTE format('SELECT last_value, is_called FROM %s', seq_name) INTO seq_last, seq_called;

  high_water := GREATEST(
    max_assigned,
    CASE WHEN seq_called THEN seq_last ELSE 0 END
  );

  IF high_water > 0 THEN
    PERFORM setval(seq_name, high_water, true);
  ELSE
    PERFORM setval(seq_name, 1, false);
  END IF;
END $$;

ALTER TABLE "products"
  ALTER COLUMN "codeNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "products_codeNumber_key" ON "products"("codeNumber");
