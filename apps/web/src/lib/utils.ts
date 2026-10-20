import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}

export const formLabels: Record<string, string> = {
  entityName: "Tên chủ thể",
  representativeName: "Người đại diện",
  representativeTitle: "Chức danh",
  contactAddress: "Địa chỉ liên hệ",
  provinceName: "Tỉnh/thành",
  phone: "Điện thoại",
  email: "Email",
  productName: "Tên sản phẩm",
  registrationType: "Loại đăng ký",
  sampleQuantity: "Số lượng mẫu",
  assessmentYear: "Năm đánh giá",
  declarationAccepted: "Cam kết hồ sơ",
};

const registrationTypeLabels: Record<string, string> = {
  FIRST: "Lần đầu",
  UPGRADE: "Nâng hạng",
  REASSESSMENT: "Đánh giá lại",
};

export function formatFormValue(value: unknown, key?: string): string {
  if (value == null || value === "") return "Chưa cung cấp";
  if (key === "registrationType" && typeof value === "string" && value in registrationTypeLabels) {
    return registrationTypeLabels[value];
  }
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (Array.isArray(value)) return value.map((item) => formatFormValue(item)).join(", ");
  if (typeof value === "object") return Object.values(value).map((item) => formatFormValue(item)).join(" · ");
  return String(value);
}

export function formatFormEntries(formData: Record<string, unknown> | undefined) {
  return Object.entries(formData ?? {}).map(([key, value]) => ({
    key,
    label: formLabels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()),
    value: formatFormValue(value, key),
  }));
}
