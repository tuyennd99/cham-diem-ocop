-- CreateTable
CREATE TABLE "registration_units" (
    "id" TEXT NOT NULL,
    "registrantId" TEXT NOT NULL,
    "entityName" VARCHAR(255) NOT NULL,
    "representativeName" VARCHAR(255) NOT NULL,
    "representativeTitle" VARCHAR(255) NOT NULL,
    "contactAddress" VARCHAR(1000) NOT NULL,
    "provinceName" VARCHAR(100) NOT NULL,
    "localityName" VARCHAR(255) NOT NULL,
    "localityCode" VARCHAR(50),
    "phone" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_units_registrantId_updatedAt_idx" ON "registration_units"("registrantId", "updatedAt");

-- AddForeignKey
ALTER TABLE "registration_units" ADD CONSTRAINT "registration_units_registrantId_fkey" FOREIGN KEY ("registrantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
