-- Drop LocalityType distinction from localities and products
ALTER TABLE "localities" DROP COLUMN "type";
ALTER TABLE "products" DROP COLUMN "localityTypeAtSubmit";
DROP TYPE "LocalityType";
