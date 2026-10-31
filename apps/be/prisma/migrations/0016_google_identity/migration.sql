-- Existing password hashes and account state are preserved.
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "googleSub" VARCHAR(255);
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");
