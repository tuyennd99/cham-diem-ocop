-- Add eventName and registrationFrom/registrationTo to localities
ALTER TABLE "localities"
  ADD COLUMN "eventName" VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN "registrationFrom" TIMESTAMPTZ(3),
  ADD COLUMN "registrationTo" TIMESTAMPTZ(3);

UPDATE "localities"
SET "eventName" = "name"
WHERE "eventName" = '';

UPDATE "localities"
SET "registrationFrom" = "effectiveFrom",
    "registrationTo" = "effectiveTo"
WHERE "registrationFrom" IS NULL AND "registrationTo" IS NULL;
