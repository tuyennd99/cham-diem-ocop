export interface JudgeCriterion {
  id: number;
  name: string;
  maxScore: number;
}

export interface JudgeSection {
  id: "A" | "B" | "C";
  label: string;
  maxScore: number;
  criteria: JudgeCriterion[];
}

export interface ScoreOption {
  points: number;
  label: string;
}

export interface Subcriterion {
  id: string;
  title: string;
  maxScore: number;
  options: ScoreOption[];
}

export interface JudgeDraft {
  activeCriterion: number;
  scores: Record<number, number>;
  selectedOptions: Record<string, number>;
  notes: Record<string, string>;
}

export const judgeSections: JudgeSection[] = [
  {
    id: "A",
    label: "Sản phẩm và sức mạnh cộng đồng",
    maxScore: 40,
    criteria: [
      { id: 1, name: "Nguồn nguyên liệu", maxScore: 10 },
      { id: 2, name: "Gia tăng giá trị", maxScore: 5 },
      { id: 3, name: "Năng lực sản xuất", maxScore: 5 },
      { id: 4, name: "Tổ chức sản xuất", maxScore: 4 },
      { id: 5, name: "Liên kết cộng đồng", maxScore: 4 },
      { id: 6, name: "Nguồn nhân lực", maxScore: 4 },
      { id: 7, name: "Bản sắc địa phương", maxScore: 4 },
      { id: 8, name: "Phát triển bền vững", maxScore: 4 },
    ],
  },
  {
    id: "B",
    label: "Khả năng tiếp thị",
    maxScore: 25,
    criteria: [
      { id: 9, name: "Nhận diện thương hiệu", maxScore: 5 },
      { id: 10, name: "Bao bì và nhãn mác", maxScore: 4 },
      { id: 11, name: "Câu chuyện sản phẩm", maxScore: 4 },
      { id: 12, name: "Kênh phân phối", maxScore: 4 },
      { id: 13, name: "Hoạt động tiếp thị", maxScore: 4 },
      { id: 14, name: "Khả năng mở rộng thị trường", maxScore: 4 },
    ],
  },
  {
    id: "C",
    label: "Chất lượng sản phẩm",
    maxScore: 35,
    criteria: [
      { id: 15, name: "Chỉ tiêu cảm quan", maxScore: 3 },
      { id: 16, name: "Giá trị dinh dưỡng", maxScore: 3 },
      { id: 17, name: "Tính độc đáo", maxScore: 3 },
      { id: 18, name: "Công bố chất lượng", maxScore: 3 },
      { id: 19, name: "Kiểm soát chất lượng", maxScore: 3 },
      { id: 20, name: "Truy xuất nguồn gốc", maxScore: 3 },
      { id: 21, name: "An toàn sản phẩm", maxScore: 3 },
      { id: 22, name: "Hướng dẫn sử dụng", maxScore: 3 },
      { id: 23, name: "Điều kiện bảo quản", maxScore: 3 },
      { id: 24, name: "Chất lượng ổn định", maxScore: 3 },
      { id: 25, name: "Nhu cầu thị trường", maxScore: 3 },
      { id: 26, name: "Khả năng tiếp cận thị trường", maxScore: 2 },
    ],
  },
];

export const allJudgeCriteria: JudgeCriterion[] = judgeSections.flatMap((section) => section.criteria);

const initialScores: Record<number, number> = {
  1: 6, 2: 5, 3: 5, 4: 4, 5: 4, 6: 4, 7: 4, 8: 3,
  9: 5, 10: 4, 11: 4, 12: 4, 13: 4, 14: 3,
  15: 3, 16: 2, 17: 2, 18: 2,
};

export const initialJudgeDraft: JudgeDraft = {
  activeCriterion: 1,
  scores: initialScores,
  selectedOptions: {
    "raw-material": 6,
    "supply-stability": 0,
    ...Object.fromEntries(Object.entries(initialScores).filter(([id]) => id !== "1").map(([id, score]) => [`criterion-${id}`, score])),
  },
  notes: {},
};

export const criterionOneSubcriteria: Subcriterion[] = [
  {
    id: "raw-material",
    title: "Nguồn gốc nguyên liệu sử dụng trong sản phẩm",
    maxScore: 6,
    options: [
      { points: 0, label: "Sử dụng nguyên liệu nhập ngoài tỉnh" },
      { points: 2, label: "Sử dụng nguyên liệu trong tỉnh dưới 50%" },
      { points: 4, label: "Sử dụng nguyên liệu trong tỉnh từ 50% trở lên" },
      { points: 6, label: "Sử dụng 100% nguyên liệu trong tỉnh, có vùng nguyên liệu ổn định" },
    ],
  },
  {
    id: "supply-stability",
    title: "Tính ổn định của vùng nguyên liệu · minh họa",
    maxScore: 4,
    options: [
      { points: 0, label: "Chưa có minh chứng về vùng nguyên liệu ổn định" },
      { points: 2, label: "Có kế hoạch duy trì nguồn cung" },
      { points: 4, label: "Có vùng nguyên liệu ổn định và hồ sơ theo dõi" },
    ],
  },
];
