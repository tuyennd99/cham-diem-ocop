import honeyImage from "../assets/images/mat-ong-u-minh.jpg";
import fishSauceImage from "../assets/images/nuoc-mam-phu-quoc.jpg";
import teaImage from "../assets/images/tra-shan-tuyet.jpg";
import garlicImage from "../assets/images/toi-den-ly-son.jpg";
import simWineImage from "../assets/images/ruou-sim-phu-quoc.png";
import herbImage from "../assets/images/cao-che-vang.jpg";
import type { DossierRecord } from "./types";

export const records = [
  {
    id: "HS-26-0012",
    slug: "mat-ong-u-minh",
    name: "Mật ong rừng U Minh",
    category: "food",
    categoryLabel: "Thực phẩm",
    origin: "Cà Mau",
    applicant: "HTX Minh họa Miền Tây",
    status: "ranked",
    statusLabel: "Đã xếp hạng",
    stage: "Đã tổng hợp phiếu",
    updated: "12/10/2026",
    rating: 5,
    image: honeyImage,
    width: 600,
    height: 450,
    alt: "Chai mật ong rừng U Minh Sinifood",
    note: "Hồ sơ minh họa đã có kết quả xếp hạng trong dữ liệu mẫu.",
  },
  {
    id: "HS-26-0011",
    slug: "nuoc-mam-phu-quoc",
    name: "Nước mắm Phú Quốc truyền thống",
    category: "food",
    categoryLabel: "Thực phẩm",
    origin: "Phú Quốc, An Giang",
    applicant: "HTX Minh họa Ven Biển",
    status: "ranked",
    statusLabel: "Đã xếp hạng",
    stage: "Đã tổng hợp phiếu",
    updated: "08/10/2026",
    rating: 5,
    image: fishSauceImage,
    width: 450,
    height: 600,
    alt: "Chai nước mắm Phú Quốc Phú Hà",
    note: "Hồ sơ minh họa đã có kết quả xếp hạng trong dữ liệu mẫu.",
  },
  {
    id: "HS-26-0010",
    slug: "tra-shan-tuyet",
    name: "Hồng trà Shan Tuyết Suối Giàng",
    category: "drink",
    categoryLabel: "Đồ uống",
    origin: "Văn Chấn, Yên Bái",
    applicant: "HTX Minh họa Suối Giàng",
    status: "ranked",
    statusLabel: "Đã xếp hạng",
    stage: "Đã tổng hợp phiếu",
    updated: "06/10/2026",
    rating: 4,
    image: teaImage,
    width: 2000,
    height: 2000,
    alt: "Hộp trà Shan Tuyết Suối Giàng, nhãn OCOP 4 sao",
    note: "Dữ liệu mẫu hiển thị kết quả 4 sao; ảnh sản phẩm cũng ghi OCOP 4 sao.",
  },
  {
    id: "HS-26-0009",
    slug: "toi-den-ly-son",
    name: "Tỏi đen cô đơn Lý Sơn",
    category: "herbal",
    categoryLabel: "Thảo dược",
    origin: "Lý Sơn, Quảng Ngãi",
    applicant: "HTX Minh họa Đảo Xanh",
    status: "ranked",
    statusLabel: "Đã xếp hạng",
    stage: "Đã tổng hợp phiếu",
    updated: "02/10/2026",
    rating: 4,
    image: garlicImage,
    width: 2048,
    height: 2048,
    alt: "Hũ tỏi đen cô đơn Lý Sơn Dori",
    note: "Hồ sơ minh họa đã có kết quả xếp hạng trong dữ liệu mẫu.",
  },
  {
    id: "HS-26-0008",
    slug: "ruou-sim-phu-quoc",
    name: "Rượu sim rừng Phú Quốc",
    category: "drink",
    categoryLabel: "Đồ uống",
    origin: "Phú Quốc, An Giang",
    applicant: "HTX Minh họa Sim Biển",
    status: "evaluating",
    statusLabel: "Đang đánh giá",
    stage: "Chờ giám khảo nộp phiếu",
    updated: "30/09/2026",
    rating: null,
    image: simWineImage,
    width: 600,
    height: 800,
    alt: "Chai rượu sim Phú Quốc Bảy Gáo",
    note: "Hồ sơ đang được đánh giá; dữ liệu mẫu chưa có kết quả xếp hạng.",
  },
  {
    id: "HS-26-0007",
    slug: "cao-che-vang",
    name: "Cao chè vằng Quảng Trị",
    category: "herbal",
    categoryLabel: "Thảo dược",
    origin: "Cam Lộ, Quảng Trị",
    applicant: "HTX Minh họa Dược Liệu",
    status: "received",
    statusLabel: "Đã tiếp nhận",
    stage: "Đã tiếp nhận hồ sơ",
    updated: "27/09/2026",
    rating: null,
    image: herbImage,
    width: 240,
    height: 240,
    alt: "Hộp và lọ cao chè vằng Mai Thị Thủy",
    note: "Hồ sơ minh họa đã tiếp nhận; chưa có kết quả xếp hạng.",
  },
] satisfies DossierRecord[];


export const categories = [
  { id: "all", label: "Tất cả" },
  { id: "food", label: "Thực phẩm" },
  { id: "drink", label: "Đồ uống" },
  { id: "herbal", label: "Thảo dược" },
] as const;
export type CategoryId = (typeof categories)[number]["id"];


export const statusOptions = [
  { id: "all", label: "Tất cả trạng thái" },
  { id: "ranked", label: "Đã xếp hạng" },
  { id: "evaluating", label: "Đang đánh giá" },
  { id: "received", label: "Đã tiếp nhận" },
] as const;
export type StatusId = (typeof statusOptions)[number]["id"];


export const imageSources: [string, string][] = [
  ["Mật ong rừng U Minh · Sinifood", "https://sinifoods.com/mat-ong-rung-u-minh"],
  ["Nước mắm Phú Quốc · TR Mart", "https://trmartpq.kiotvietweb.vn/c/2501-gia-vi/p/phu-ha-nuoc-mam-phu-quoc-40-dam-510ml-fish-sauce-ea7f6c"],
  ["Trà Shan Tuyết Suối Giàng · SugiTea", "https://sugitea.com/bach-tra-shan-tuyet-co-thu"],
  ["Tỏi đen Lý Sơn · Dori", "https://dori.com.vn/products/toi-den-co-don-ly-son-dori-hu-thuy-tinh-100g-toi-den-mot-tep-ly-son"],
  ["Rượu sim Phú Quốc · Bảy Gáo", "https://dacsanviet98.com/products/ruou-sim-phu-quoc-14-do"],
  ["Cao chè vằng · OCOP Store", "https://ocopstore.com/cao-che-vang-co-dac-mai-thi-thuy-hop-100gr"],
];
