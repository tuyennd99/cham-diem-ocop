import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productEditorCategories } from "../src/lib/product-editor-categories";
import type { RegistrantCategory, RegistrantProduct } from "../src/types/registrant";

const activeCategory: RegistrantCategory = {
  id: "active", name: "Đang dùng", groupCode: "FOOD", groupName: "Thực phẩm",
  classificationGroup: "Nông sản", classificationSubgroup: null,
};

function draftWithRetiredCategory(
  overrides: Partial<RegistrantProduct["category"]> = {},
): Pick<RegistrantProduct, "status" | "category"> {
  return {
    status: "DRAFT",
    category: {
      id: "retired", name: "Đã ngừng", groupCode: "FOOD", groupName: "Thực phẩm",
      classificationGroup: "Nông sản", classificationSubgroup: "Rau củ",
      isActive: false, group: { isActive: true }, criteriaSet: { isActive: true },
      ...overrides,
    },
  };
}

describe("productEditorCategories", () => {
  it("keeps active choices and appends a retired draft category as unavailable", () => {
    const result = productEditorCategories([activeCategory], draftWithRetiredCategory());

    assert.deepEqual(result.map(({ id, unavailable }) => ({ id, unavailable })), [
      { id: "active", unavailable: undefined },
      { id: "retired", unavailable: true },
    ]);
  });

  it("keeps new registrations limited to active category choices", () => {
    assert.deepEqual(productEditorCategories([activeCategory], null), [activeCategory]);
  });

  it("marks a draft unavailable when its group or criteria set was retired", () => {
    for (const category of [
      { isActive: true, group: { isActive: false }, criteriaSet: { isActive: true } },
      { isActive: true, group: { isActive: true }, criteriaSet: { isActive: false } },
    ]) {
      const result = productEditorCategories([activeCategory], draftWithRetiredCategory(category));
      assert.equal(result.at(-1)?.unavailable, true);
    }
  });
});
