-- Legacy recovery retirement: first inventory REGISTRANT users with verified=false,
-- including locked users, and their products, createdProducts, assignments, evaluations,
-- OTPs and audit history. Review each account and its recovery route with administrators
-- before removing /auth/legacy-registration/verify and /resend. Do not delete, bulk
-- activate, or automatically convert these accounts. Read-only inventory starting point:
-- SELECT u."id", u."email", u."isActive", u."createdAt",
--   (SELECT count(*) FROM "products" p WHERE p."registrantId" = u."id" OR p."createdById" = u."id") AS products,
--   (SELECT count(*) FROM "evaluations" e WHERE e."judgeId" = u."id") AS evaluations,
--   (SELECT count(*) FROM "judge_assignments" j WHERE j."judgeId" = u."id") AS assignments,
--   (SELECT count(*) FROM "otp_codes" o WHERE o."userId" = u."id") AS otps,
--   (SELECT count(*) FROM "audit_logs" a WHERE a."actorId" = u."id") AS audit_logs
-- FROM "users" u WHERE u."role" = 'REGISTRANT' AND u."verified" = false;

-- Additive only: existing users and legacy OTPs remain unchanged.
CREATE TYPE "PendingAuthKind" AS ENUM ('EMAIL_REGISTER', 'GOOGLE_PROFILE', 'GOOGLE_REGISTER', 'GOOGLE_LINK', 'GOOGLE_CHALLENGE');

CREATE TABLE "pending_auth" (
    "id" TEXT NOT NULL,
    "kind" "PendingAuthKind" NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "email" VARCHAR(320),
    "fullName" VARCHAR(255),
    "phone" VARCHAR(30),
    "passwordHash" VARCHAR(255),
    "googleSub" VARCHAR(255),
    "nonceHash" VARCHAR(64),
    "userId" TEXT,
    "otpHash" VARCHAR(64),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "otpExpiresAt" TIMESTAMPTZ(3),
    "resendAvailableAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pending_auth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_auth_tokenHash_key" ON "pending_auth"("tokenHash");
CREATE INDEX "pending_auth_expiresAt_idx" ON "pending_auth"("expiresAt");
