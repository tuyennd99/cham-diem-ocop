BEGIN;

LOCK TABLE "product_groups", "product_categories" IN ACCESS EXCLUSIVE MODE;

-- Preserve obsolete classification metadata for historical audit.
CREATE TABLE "legacy_category_metadata" (
  "id" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL
);
INSERT INTO "legacy_category_metadata" ("id", "data")
SELECT c."id", jsonb_build_object(
  'name', c."name", 'order', c."order", 'isActive', c."isActive",
  'groupId', c."groupId", 'groupCode', c."groupCode", 'groupName', c."groupName",
  'classificationGroup', c."classificationGroup", 'classificationSubgroup', c."classificationSubgroup",
  'group', to_jsonb(g)
) FROM "product_categories" c LEFT JOIN "product_groups" g ON g."id" = c."groupId";

CREATE TABLE "legacy_product_group_metadata" (
  "id" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL
);
INSERT INTO "legacy_product_group_metadata" ("id", "data")
SELECT "id", to_jsonb(g) FROM "product_groups" g;

-- Preserve effective availability when removing the group-level switch.
UPDATE "product_categories" c SET "isActive" = false
FROM "product_groups" g WHERE c."groupId" = g."id" AND NOT g."isActive";

UPDATE "product_categories" c SET "name" = v."name", "order" = v."order"
FROM (VALUES
  ('fresh-produce', 'Rau, củ, quả, hạt tươi', 1),
  ('fresh-animal-products', 'Thịt, thủy sản, trứng, sữa tươi', 2),
  ('processed-grains', 'Gạo, ngũ cốc, hạt sơ chế khác', 3),
  ('honey-and-other-agri-food', 'Mật ong, mật khác và nông sản thực phẩm khác', 4),
  ('ready-to-eat', 'Đồ ăn nhanh', 5),
  ('grain-products', 'Chế biến từ gạo, ngũ cốc', 6),
  ('processed-produce', 'Chế biến từ rau, củ, quả, hạt', 7),
  ('processed-animal-and-agri-food', 'Chế biến từ thịt, thủy sản, trứng, sữa, các sản phẩm từ mật ong, mật khác và nông sản thực phẩm khác', 8),
  ('liquid-condiments', 'Tương, nước mắm, gia vị dạng lỏng khác', 9),
  ('other-condiments', 'Gia vị khác (muối, hành, tỏi, tiêu)', 10),
  ('tea', 'Chè tươi, chè chế biến', 11),
  ('herbal-tea', 'Sản phẩm trà từ thực vật khác', 12),
  ('coffee-cocoa', 'Cà phê, cacao', 13),
  ('white-liquor', 'Rượu trắng', 14),
  ('other-alcoholic-drinks', 'Đồ uống có cồn khác', 15),
  ('bottled-water', 'Nước khoáng thiên nhiên, nước uống đóng chai', 16),
  ('other-non-alcoholic-drinks', 'Đồ uống không cồn khác', 17),
  ('herbal-functional-products', 'Thực phẩm chức năng, thuốc dược liệu, thuốc cổ truyền', 18),
  ('herbal-cosmetics', 'Mỹ phẩm có thành phần từ dược liệu', 19),
  ('essential-oils-and-herbs', 'Tinh dầu và dược liệu khác', 20),
  ('handicraft', 'Thủ công mỹ nghệ', 21),
  ('textiles-apparel', 'Vải, may mặc', 22),
  ('flowers', 'Hoa', 23),
  ('ornamental-plants', 'Cây cảnh', 24),
  ('ornamental-animals', 'Động vật cảnh', 25),
  ('community-ecotourism', 'Dịch vụ du lịch cộng đồng, du lịch sinh thái và điểm du lịch', 26)
) AS v("id", "name", "order") WHERE c."id" = v."id";

ALTER TABLE "product_categories" DROP CONSTRAINT "product_categories_groupId_fkey";
DROP INDEX "product_categories_groupCode_name_idx";
ALTER TABLE "product_categories"
  DROP COLUMN "groupId", DROP COLUMN "groupCode", DROP COLUMN "groupName",
  DROP COLUMN "classificationGroup", DROP COLUMN "classificationSubgroup";
DROP TABLE "product_groups";

COMMIT;
