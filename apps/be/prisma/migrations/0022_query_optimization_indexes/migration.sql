-- Gói B Step 4: Query optimization indexes verified against 10k-row PostgreSQL EXPLAIN ANALYZE
-- B-tree indexes aligned with schema.prisma models
CREATE INDEX IF NOT EXISTS "otp_codes_email_purpose_createdAt_idx" ON "otp_codes"("email", "purpose", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");
CREATE INDEX IF NOT EXISTS "products_status_submittedAt_idx" ON "products"("status", "submittedAt");
CREATE INDEX IF NOT EXISTS "products_status_completedAt_idx" ON "products"("status", "completedAt");
CREATE INDEX IF NOT EXISTS "products_localityId_idx" ON "products"("localityId");
CREATE INDEX IF NOT EXISTS "products_registrantId_status_updatedAt_idx" ON "products"("registrantId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "products_formData_idx" ON "products" USING GIN ("formData" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "evaluations_judgeId_status_idx" ON "evaluations"("judgeId", "status");

-- Functional indexes beyond Prisma schema syntax (no extension dependency across isolated schemas)
CREATE INDEX IF NOT EXISTS "localities_lower_province_name_idx" ON "localities"(LOWER("provinceName"), LOWER("name"));
CREATE INDEX IF NOT EXISTS "products_formatted_code_pattern_idx" ON "products"(
  ('OCOP-' || LPAD("codeNumber"::text, GREATEST(6, LENGTH("codeNumber"::text)), '0')) text_pattern_ops
) WHERE "codeNumber" IS NOT NULL AND "codeNumber" >= 1;
