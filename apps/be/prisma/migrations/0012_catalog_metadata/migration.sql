ALTER TABLE "product_groups" ADD COLUMN "description" TEXT;
ALTER TABLE "product_categories" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
