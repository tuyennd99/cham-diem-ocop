import type { RegistrantProduct } from "./registrant";
import type { EvaluationData } from "./judge";

const summary = {
  id: "category-1", name: "Phân loại", groupCode: "A", groupName: "Nhóm",
  classificationGroup: "Nông nghiệp", classificationSubgroup: null,
  isActive: true, group: { isActive: true }, criteriaSet: { isActive: true },
} satisfies RegistrantProduct["category"];

const evaluation = {
  product: {
    id: "product-1", name: "Hồ sơ", description: null, formData: {},
    category: { id: "category-1", name: "Phân loại", groupName: "Nhóm" },
    attachments: [{ id: "file-1", type: "EVIDENCE", fileName: "proof.pdf" }],
  },
  criteria: [],
  evaluation: { id: null, status: "IN_PROGRESS", total: null, scores: [] },
} satisfies EvaluationData;

type Assert<T extends true> = T;
type NoQueueStatus = Assert<"status" extends keyof EvaluationData["product"] ? false : true>;
type NoAttachmentDate = Assert<"createdAt" extends keyof EvaluationData["product"]["attachments"][number] ? false : true>;
void summary;
void evaluation;
