import {
  EvaluationStatus,
  LocalityType,
  Prisma,
  PrismaClient,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProductApplicationForm } from '@ocop/shared';
import { storageRoot } from '../../src/utils/private-storage';
import { buildRegistrationSnapshot } from '../../src/utils/registration-snapshot';
import { calculateFinalScore, calculateStars } from '../../src/utils/scoring';

const FALLBACK_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

type ScoreTier = 'top' | 'high' | 'mid';

interface LoadedSubCriterion {
  id: string;
  code: string;
  content: string;
  order: number;
  options: Array<{ id: string; label: string; points: number; order: number }>;
}

interface LoadedCriterion {
  id: string;
  code: string;
  name: string;
  maxScore: number;
  order: number;
  sectionCode: string;
  sectionName: string;
  subCriteria: LoadedSubCriterion[];
}

interface LoadedCategory {
  id: string;
  name: string;
  classificationGroup: string;
  classificationSubgroup: string | null;
  group: { id: string; code: string; name: string };
  criteriaSet: {
    id: string;
    name: string | null;
    source: string | null;
    version: string;
    sourceHash: string | null;
    criteria: LoadedCriterion[];
  } | null;
}

function pickOptionForTier(
  options: LoadedSubCriterion['options'],
  tier: ScoreTier,
  subIndex: number,
  judgeOffset: number,
) {
  const sorted = [...options].sort(
    (a, b) => a.points - b.points || a.order - b.order,
  );
  const maxIdx = sorted.length - 1;
  if (maxIdx <= 0) return sorted[0];

  if (tier === 'top') {
    const idx =
      (subIndex + judgeOffset) % 6 === 0 ? Math.max(0, maxIdx - 1) : maxIdx;
    return sorted[idx];
  }
  if (tier === 'high') {
    const idx =
      (subIndex + judgeOffset) % 3 === 0 ? Math.max(0, maxIdx - 1) : maxIdx;
    return sorted[idx];
  }
  // 'mid' -> ~58-68 points (3 stars)
  const midIdx = Math.max(0, maxIdx - 1);
  const idx =
    (subIndex + judgeOffset) % 4 === 0 ? Math.max(0, maxIdx - 2) : midIdx;
  return sorted[idx];
}

export async function seedSampleOcopData(
  prisma: PrismaClient,
  passwordHash: string,
) {
  const units = [
    {
      id: 'seed-unit-snnmt',
      code: 'SNNMT',
      name: 'Sở Nông nghiệp và Môi trường',
      description: 'Đơn vị thường trực Hội đồng đánh giá, phân hạng sản phẩm OCOP',
      order: 1,
    },
    {
      id: 'seed-unit-sct',
      code: 'SCT',
      name: 'Sở Công Thương',
      description: 'Đơn vị thành viên phụ trách xúc tiến thương mại và thị trường',
      order: 2,
    },
    {
      id: 'seed-unit-svhttdl',
      code: 'SVHTTDL',
      name: 'Sở Văn hóa, Thể thao và Du lịch',
      description: 'Đơn vị thành viên phụ trách du lịch cộng đồng và bản sắc văn hóa',
      order: 3,
    },
  ];

  for (const unit of units) {
    await prisma.organizationUnit.upsert({
      where: { code: unit.code },
      update: {
        name: unit.name,
        description: unit.description,
        order: unit.order,
        isActive: true,
      },
      create: {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        description: unit.description,
        order: unit.order,
        isActive: true,
      },
    });
  }

  const unitByCode = new Map(
    (
      await prisma.organizationUnit.findMany({
        where: { code: { in: units.map((u) => u.code) } },
      })
    ).map((u) => [u.code, u]),
  );

  const localities = [
    {
      id: 'seed-locality-khanh-an',
      code: 'XP-KHANHAN',
      name: 'Xã Khánh An',
      type: LocalityType.COMMUNE,
      provinceName: 'Tỉnh Cà Mau',
    },
    {
      id: 'seed-locality-rach-goc',
      code: 'XP-RACHGOC',
      name: 'Phường Rạch Gốc',
      type: LocalityType.WARD,
      provinceName: 'Tỉnh Cà Mau',
    },
    {
      id: 'seed-locality-dat-mui',
      code: 'XP-DATMUI',
      name: 'Xã Đất Mũi',
      type: LocalityType.COMMUNE,
      provinceName: 'Tỉnh Cà Mau',
    },
    {
      id: 'seed-locality-tran-van-thoi',
      code: 'XP-TVTHOI',
      name: 'Xã Trần Văn Thời',
      type: LocalityType.COMMUNE,
      provinceName: 'Tỉnh Cà Mau',
    },
  ];

  for (const loc of localities) {
    await prisma.locality.upsert({
      where: { code: loc.code },
      update: {
        name: loc.name,
        type: loc.type,
        provinceName: loc.provinceName,
        effectiveFrom: new Date('2020-01-01T00:00:00+07:00'),
        effectiveTo: null,
        isActive: true,
      },
      create: {
        id: loc.id,
        code: loc.code,
        name: loc.name,
        type: loc.type,
        provinceName: loc.provinceName,
        effectiveFrom: new Date('2020-01-01T00:00:00+07:00'),
        isActive: true,
      },
    });
  }

  const localityByCode = new Map(
    (
      await prisma.locality.findMany({
        where: { code: { in: localities.map((l) => l.code) } },
      })
    ).map((l) => [l.code, l]),
  );

  // Assign organization units to staff test accounts and upsert extra registrants
  const snnmt = unitByCode.get('SNNMT')!;
  const sct = unitByCode.get('SCT')!;
  const svhttdl = unitByCode.get('SVHTTDL')!;

  await prisma.user.updateMany({
    where: { email: { in: ['admin@ocop.test', 'judge@ocop.test'] } },
    data: { organizationUnitId: snnmt.id },
  });
  await prisma.user.updateMany({
    where: { email: { in: ['admin.score@ocop.test', 'viewer.score@ocop.test'] } },
    data: { organizationUnitId: sct.id },
  });
  await prisma.user.updateMany({
    where: { email: 'viewer@ocop.test' },
    data: { organizationUnitId: svhttdl.id },
  });

  const extraRegistrants = [
    {
      email: 'htx.uminh@ocop.test',
      fullName: 'Hợp tác xã Mật ong rừng U Minh Hạ',
      phone: '0900000007',
    },
    {
      email: 'htx.rachgoc@ocop.test',
      fullName: 'Hợp tác xã Thủy sản Sinh thái Rạch Gốc',
      phone: '0900000008',
    },
  ];
  for (const reg of extraRegistrants) {
    await prisma.user.upsert({
      where: { email: reg.email },
      update: {
        fullName: reg.fullName,
        phone: reg.phone,
        role: Role.REGISTRANT,
        staffPermissions: [],
        verified: true,
        isActive: true,
      },
      create: {
        email: reg.email,
        password: passwordHash,
        fullName: reg.fullName,
        phone: reg.phone,
        role: Role.REGISTRANT,
        staffPermissions: [],
        verified: true,
        isActive: true,
      },
    });
  }

  const usersByEmail = new Map(
    (
      await prisma.user.findMany({
        where: {
          email: {
            in: [
              'admin@ocop.test',
              'judge@ocop.test',
              'viewer.score@ocop.test',
              'registrant@ocop.test',
              'htx.uminh@ocop.test',
              'htx.rachgoc@ocop.test',
            ],
          },
        },
        include: { organizationUnit: { select: { id: true, code: true, name: true } } },
      })
    ).map((u) => [u.email, u]),
  );

  const judge1 = usersByEmail.get('judge@ocop.test')!;
  const judge2 = usersByEmail.get('viewer.score@ocop.test')!;

  const sampleProductsSpec: Array<{
    id: string;
    categoryId: string;
    registrantEmail: string;
    localityCode: string;
    name: string;
    description: string;
    status: ProductStatus;
    createdAt: string;
    submittedAt?: string;
    scoringAt?: string;
    completedAt?: string;
    scoreTier?: ScoreTier;
    scoringMode?: 'one_submitted_one_draft' | 'one_draft';
    formData: ProductApplicationForm;
  }> = [
    {
      id: 'seed-product-01',
      categoryId: 'honey-and-other-agri-food',
      registrantEmail: 'registrant@ocop.test',
      localityCode: 'XP-KHANHAN',
      name: 'Mật ong rừng tràm U Minh Hạ nguyên chất 500ml',
      description:
        'Mật ong khai thác tự nhiên từ vùng rừng tràm U Minh Hạ, đóng chai thủy tinh 500ml, có tem truy xuất nguồn gốc QR và chứng nhận an toàn thực phẩm.',
      status: ProductStatus.COMPLETED,
      createdAt: '2026-09-05T08:00:00+07:00',
      submittedAt: '2026-09-06T09:30:00+07:00',
      scoringAt: '2026-09-10T14:00:00+07:00',
      completedAt: '2026-09-15T16:00:00+07:00',
      scoreTier: 'high',
      formData: {
        entityName: 'Hợp tác xã Nông lâm sản Khánh An',
        representativeName: 'Nguyễn Văn An',
        representativeTitle: 'Giám đốc Hợp tác xã',
        contactAddress: 'Ấp 3, Xã Khánh An, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000006',
        email: 'registrant@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 6,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-02',
      categoryId: 'processed-animal-and-agri-food',
      registrantEmail: 'registrant@ocop.test',
      localityCode: 'XP-RACHGOC',
      name: 'Tôm khô sinh thái Rạch Gốc loại 1 (Hộp 500g)',
      description:
        'Tôm đất tự nhiên vùng rừng ngập mặn Rạch Gốc luộc muối hạt và sấy truyền thống, đạt chứng nhận HACCP và bao bì hút chân không cao cấp.',
      status: ProductStatus.COMPLETED,
      createdAt: '2026-10-01T08:30:00+07:00',
      submittedAt: '2026-10-02T10:00:00+07:00',
      scoringAt: '2026-10-05T09:00:00+07:00',
      completedAt: '2026-10-08T15:30:00+07:00',
      scoreTier: 'top',
      formData: {
        entityName: 'Hợp tác xã Thủy sản Sinh thái Rạch Gốc',
        representativeName: 'Trần Minh Hải',
        representativeTitle: 'Chủ tịch Hội đồng quản trị',
        contactAddress: 'Khóm 4, Phường Rạch Gốc, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000006',
        email: 'registrant@ocop.test',
        registrationType: 'UPGRADE',
        sampleQuantity: 10,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-03',
      categoryId: 'liquid-condiments',
      registrantEmail: 'htx.rachgoc@ocop.test',
      localityCode: 'XP-RACHGOC',
      name: 'Nước mắm truyền thống Cà Mau 40 độ đạm',
      description:
        'Nước mắm ủ chượp tự nhiên 18 tháng từ cá cơm tươi vùng biển Tây Nam và muối Bạc Liêu lưu kho.',
      status: ProductStatus.COMPLETED,
      createdAt: '2026-10-03T09:00:00+07:00',
      submittedAt: '2026-10-04T11:00:00+07:00',
      scoringAt: '2026-10-07T14:00:00+07:00',
      completedAt: '2026-10-10T16:30:00+07:00',
      scoreTier: 'mid',
      formData: {
        entityName: 'Cơ sở Nước mắm Truyền thống Biển Tây',
        representativeName: 'Lê Thị Bích Thủy',
        representativeTitle: 'Chủ cơ sở',
        contactAddress: 'Khóm 2, Phường Rạch Gốc, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000008',
        email: 'htx.rachgoc@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 6,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-04',
      categoryId: 'other-alcoholic-drinks',
      registrantEmail: 'htx.uminh@ocop.test',
      localityCode: 'XP-KHANHAN',
      name: 'Rượu trái giác rừng U Minh lên men tự nhiên',
      description:
        'Rượu vang lên men tự nhiên từ trái giác rừng chín mọng vùng U Minh Hạ, hương vị chua dịu đặc trưng miền Tây Nam Bộ.',
      status: ProductStatus.COMPLETED,
      createdAt: '2026-10-04T08:00:00+07:00',
      submittedAt: '2026-10-05T10:15:00+07:00',
      scoringAt: '2026-10-09T09:00:00+07:00',
      completedAt: '2026-10-12T17:00:00+07:00',
      scoreTier: 'high',
      formData: {
        entityName: 'Hợp tác xã Mật ong rừng U Minh Hạ',
        representativeName: 'Phạm Quốc Việt',
        representativeTitle: 'Giám đốc Hợp tác xã',
        contactAddress: 'Ấp 7, Xã Khánh An, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000007',
        email: 'htx.uminh@ocop.test',
        registrationType: 'REASSESSMENT',
        sampleQuantity: 6,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-05',
      categoryId: 'essential-oils-and-herbs',
      registrantEmail: 'registrant@ocop.test',
      localityCode: 'XP-KHANHAN',
      name: 'Tinh dầu tràm gió nguyên chất Khánh An 100ml',
      description:
        'Tinh dầu chưng cất hơi nước từ lá tràm gió bản địa vùng đệm Vườn quốc gia U Minh Hạ, hàm lượng Cineol đạt trên 65%.',
      status: ProductStatus.SCORING,
      createdAt: '2026-10-11T08:00:00+07:00',
      submittedAt: '2026-10-12T09:30:00+07:00',
      scoringAt: '2026-10-14T10:00:00+07:00',
      scoreTier: 'high',
      scoringMode: 'one_submitted_one_draft',
      formData: {
        entityName: 'Công ty TNHH Dược liệu Rừng Tràm Cà Mau',
        representativeName: 'Nguyễn Văn An',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Ấp 5, Xã Khánh An, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000006',
        email: 'registrant@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 8,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-06',
      categoryId: 'handicraft',
      registrantEmail: 'registrant@ocop.test',
      localityCode: 'XP-TVTHOI',
      name: 'Giỏ đan bồn bồn thủ công mỹ nghệ Tân Hưng',
      description:
        'Sản phẩm đan lát thủ công từ sợi bồn bồn phơi khô xử lý chống ẩm mốc, thân thiện với môi trường và gắn với làng nghề truyền thống.',
      status: ProductStatus.SCORING,
      createdAt: '2026-10-13T08:00:00+07:00',
      submittedAt: '2026-10-14T10:30:00+07:00',
      scoringAt: '2026-10-16T14:00:00+07:00',
      scoreTier: 'mid',
      scoringMode: 'one_draft',
      formData: {
        entityName: 'Tổ hợp tác Đan lát Thủ công Trần Văn Thời',
        representativeName: 'Võ Thị Kim Loan',
        representativeTitle: 'Tổ trưởng Tổ hợp tác',
        contactAddress: 'Ấp Tân Hưng, Xã Trần Văn Thời, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000006',
        email: 'registrant@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 4,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-07',
      categoryId: 'community-ecotourism',
      registrantEmail: 'registrant@ocop.test',
      localityCode: 'XP-DATMUI',
      name: 'Điểm du lịch sinh thái cộng đồng Mũi Cà Mau',
      description:
        'Trải nghiệm sinh thái rừng ngập mặn cực Nam Tổ quốc, tham quan mô hình nuôi tôm - cua dưới tán rừng đước và thưởng thức ẩm thực bản địa.',
      status: ProductStatus.SUBMITTED,
      createdAt: '2026-10-17T08:30:00+07:00',
      submittedAt: '2026-10-18T09:45:00+07:00',
      formData: {
        entityName: 'Hợp tác xã Du lịch Cộng đồng Đất Mũi',
        representativeName: 'Nguyễn Văn An',
        representativeTitle: 'Giám đốc Hợp tác xã',
        contactAddress: 'Ấp Mũi, Xã Đất Mũi, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000006',
        email: 'registrant@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 1,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-08',
      categoryId: 'ornamental-plants',
      registrantEmail: 'htx.uminh@ocop.test',
      localityCode: 'XP-KHANHAN',
      name: 'Hoa lan rừng thuần dưỡng U Minh Hạ',
      description:
        'Bộ sưu tập giống lan bản địa nhân giống và thuần dưỡng thích nghi khí hậu đồng bằng sông Cửu Long, kèm hướng dẫn chăm sóc sinh học.',
      status: ProductStatus.SUBMITTED,
      createdAt: '2026-10-19T09:00:00+07:00',
      submittedAt: '2026-10-20T14:20:00+07:00',
      formData: {
        entityName: 'Hợp tác xã Sinh vật cảnh Khánh An',
        representativeName: 'Phạm Quốc Việt',
        representativeTitle: 'Chủ nhiệm Hợp tác xã',
        contactAddress: 'Ấp 1, Xã Khánh An, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000007',
        email: 'htx.uminh@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 5,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-09',
      categoryId: 'processed-grains',
      registrantEmail: 'registrant@ocop.test',
      localityCode: 'XP-TVTHOI',
      name: 'Gạo hữu cơ ST25 vùng tôm - lúa Trần Văn Thời (Túi 5kg)',
      description:
        'Gạo thơm ST25 canh tác luân canh trên nền đất nuôi tôm sinh thái không sử dụng thuốc bảo vệ thực vật hóa học, hạt gạo dẻo thơm tự nhiên.',
      status: ProductStatus.DRAFT,
      createdAt: '2026-10-21T10:00:00+07:00',
      formData: {
        entityName: 'Hợp tác xã Lúa - Tôm Sạch Trần Văn Thời',
        representativeName: 'Nguyễn Văn An',
        representativeTitle: 'Giám đốc Hợp tác xã',
        contactAddress: 'Ấp Công Nghiệp, Xã Trần Văn Thời, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000006',
        email: 'registrant@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 6,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
    {
      id: 'seed-product-10',
      categoryId: 'other-non-alcoholic-drinks',
      registrantEmail: 'registrant@ocop.test',
      localityCode: 'XP-DATMUI',
      name: 'Trà mãng cầu xiêm túi lọc Đất Mũi (Hộp 25 túi)',
      description:
        'Trà chế biến từ thịt quả mãng cầu xiêm canh tác hữu cơ vùng đất nhiễm mặn nhẹ, sấy lạnh giữ nguyên hương thơm và dưỡng chất.',
      status: ProductStatus.DRAFT,
      createdAt: '2026-10-22T15:00:00+07:00',
      formData: {
        entityName: 'Cơ sở Chế biến Nông sản Đất Mũi',
        representativeName: 'Nguyễn Văn An',
        representativeTitle: 'Chủ cơ sở',
        contactAddress: 'Ấp Khai Long, Xã Đất Mũi, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0900000006',
        email: 'registrant@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 6,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    },
  ];

  const categoryIds = [...new Set(sampleProductsSpec.map((p) => p.categoryId))];
  const loadedCategories = await prisma.productCategory.findMany({
    where: { id: { in: categoryIds } },
    select: {
      id: true,
      name: true,
      classificationGroup: true,
      classificationSubgroup: true,
      group: { select: { id: true, code: true, name: true } },
      criteriaSet: {
        select: {
          id: true,
          name: true,
          source: true,
          version: true,
          sourceHash: true,
          criteria: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              code: true,
              name: true,
              maxScore: true,
              order: true,
              sectionCode: true,
              sectionName: true,
              subCriteria: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  code: true,
                  content: true,
                  order: true,
                  options: {
                    orderBy: { order: 'asc' },
                    select: { id: true, label: true, points: true, order: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const categoryById = new Map<string, LoadedCategory>(
    loadedCategories.map((c) => [c.id, c]),
  );

  // Assign judge1 and judge2 full-scope on all sample categories
  for (const categoryId of categoryIds) {
    for (const judge of [judge1, judge2]) {
      await prisma.judgeAssignment.upsert({
        where: {
          judgeId_categoryId: { judgeId: judge.id, categoryId },
        },
        update: { criterionIds: [] },
        create: {
          judgeId: judge.id,
          categoryId,
          criterionIds: [],
        },
      });
    }
  }

  for (const spec of sampleProductsSpec) {
    const category = categoryById.get(spec.categoryId);
    const registrant = usersByEmail.get(spec.registrantEmail);
    const locality = localityByCode.get(spec.localityCode);
    if (!category || !registrant || !locality) continue;

    const createdAt = new Date(spec.createdAt);
    const submittedAt = spec.submittedAt ? new Date(spec.submittedAt) : null;
    const scoringAt = spec.scoringAt ? new Date(spec.scoringAt) : null;
    const completedAt = spec.completedAt ? new Date(spec.completedAt) : null;

    const registrationSnapshot = submittedAt
      ? (buildRegistrationSnapshot({
          submittedAt,
          product: {
            id: spec.id,
            name: spec.name,
            description: spec.description,
            formData: spec.formData as unknown as Prisma.JsonValue,
          },
          registrant: {
            id: registrant.id,
            fullName: registrant.fullName,
            email: registrant.email,
            phone: registrant.phone,
          },
          category: {
            id: category.id,
            name: category.name,
            classificationGroup: category.classificationGroup,
            classificationSubgroup: category.classificationSubgroup,
          },
          group: category.group,
          locality: {
            id: locality.id,
            code: locality.code,
            name: locality.name,
            type: locality.type,
            provinceName: locality.provinceName,
          },
        }) as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull;

    await prisma.product.upsert({
      where: { id: spec.id },
      update: {
        createdById: registrant.id,
        registrantId: registrant.id,
        categoryId: category.id,
        localityId: locality.id,
        name: spec.name,
        description: spec.description,
        formData: spec.formData as unknown as Prisma.InputJsonValue,
        status: spec.status,
        createdAt,
        submittedAt,
        completedAt,
        registrationSnapshot,
        localityCodeAtSubmit: submittedAt ? locality.code : null,
        localityNameAtSubmit: submittedAt ? locality.name : null,
        localityTypeAtSubmit: submittedAt ? locality.type : null,
        provinceNameAtSubmit: submittedAt ? locality.provinceName : null,
      },
      create: {
        id: spec.id,
        createdById: registrant.id,
        registrantId: registrant.id,
        categoryId: category.id,
        localityId: locality.id,
        name: spec.name,
        description: spec.description,
        formData: spec.formData as unknown as Prisma.InputJsonValue,
        status: spec.status,
        createdAt,
        submittedAt,
        completedAt,
        registrationSnapshot,
        localityCodeAtSubmit: submittedAt ? locality.code : null,
        localityNameAtSubmit: submittedAt ? locality.name : null,
        localityTypeAtSubmit: submittedAt ? locality.type : null,
        provinceNameAtSubmit: submittedAt ? locality.provinceName : null,
      },
    });

    // Replace status events deterministically
    const statusEvents: Array<{
      sequence: number;
      fromStatus: ProductStatus | null;
      toStatus: ProductStatus;
      actorId: string;
      createdAt: Date;
    }> = [
      {
        sequence: 1,
        fromStatus: null,
        toStatus: ProductStatus.DRAFT,
        actorId: registrant.id,
        createdAt,
      },
    ];
    if (submittedAt) {
      statusEvents.push({
        sequence: 2,
        fromStatus: ProductStatus.DRAFT,
        toStatus: ProductStatus.SUBMITTED,
        actorId: registrant.id,
        createdAt: submittedAt,
      });
    }
    if (scoringAt) {
      statusEvents.push({
        sequence: 3,
        fromStatus: ProductStatus.SUBMITTED,
        toStatus: ProductStatus.SCORING,
        actorId: judge1.id,
        createdAt: scoringAt,
      });
    }
    if (completedAt) {
      statusEvents.push({
        sequence: 4,
        fromStatus: ProductStatus.SCORING,
        toStatus: ProductStatus.COMPLETED,
        actorId: judge2.id,
        createdAt: completedAt,
      });
    }

    await prisma.productStatusEvent.deleteMany({
      where: { productId: spec.id },
    });
    await prisma.productStatusEvent.createMany({
      data: statusEvents.map((ev) => ({
        productId: spec.id,
        ...ev,
      })),
    });

    const suffix = spec.id.slice(-2);
    const storageKey = `019a0000-0000-7000-8000-0000000000${suffix}`;
    const root = storageRoot();
    mkdirSync(root, { recursive: true });
    const storedFilePath = join(root, storageKey);
    if (!existsSync(storedFilePath)) {
      writeFileSync(storedFilePath, FALLBACK_JPEG);
    }
    await prisma.attachment.upsert({
      where: { id: `seed-attachment-img-${suffix}` },
      update: {
        productId: spec.id,
        type: 'IMAGE',
        fileName: `anh-san-pham-${suffix}.jpg`,
        filePath: storageKey,
      },
      create: {
        id: `seed-attachment-img-${suffix}`,
        productId: spec.id,
        type: 'IMAGE',
        fileName: `anh-san-pham-${suffix}.jpg`,
        filePath: storageKey,
        createdAt,
      },
    });

    // Build evaluations & scores for SCORING and COMPLETED products
    const criteriaSet = category.criteriaSet;
    if (
      !criteriaSet ||
      (spec.status !== ProductStatus.SCORING &&
        spec.status !== ProductStatus.COMPLETED)
    ) {
      continue;
    }

    const tier = spec.scoreTier ?? 'high';
    const allCriteria = criteriaSet.criteria;
    const allCriterionIds = allCriteria.map((c) => c.id);
    const flatSubs = allCriteria.flatMap((criterion) =>
      criterion.subCriteria.map((sub) => ({ criterion, sub })),
    );

    const buildJudgeScores = (
      judge: typeof judge1,
      judgeOffset: number,
      submitEvaluation: boolean,
      evalTimestamp: Date,
      partialCount?: number,
    ) => {
      const selectedSubs =
        partialCount !== undefined ? flatSubs.slice(0, partialCount) : flatSubs;
      const chosen = selectedSubs.map(({ criterion, sub }, idx) => {
        const option = pickOptionForTier(sub.options, tier, idx, judgeOffset);
        return {
          criterion,
          sub,
          option,
          note:
            idx === 0
              ? 'Hồ sơ minh chứng đầy đủ, trình bày rõ ràng.'
              : null,
        };
      });
      const total = chosen.reduce((sum, item) => sum + item.option.points, 0);
      const criterionTotals: Record<string, number> = {};
      for (const item of chosen) {
        criterionTotals[item.criterion.id] =
          (criterionTotals[item.criterion.id] ?? 0) + item.option.points;
      }

      const submissionSnapshot = submitEvaluation
        ? ({
            version: 1,
            submittedAt: evalTimestamp.toISOString(),
            product: {
              id: spec.id,
              name: spec.name,
              description: spec.description,
              formData: spec.formData,
              category: {
                id: category.id,
                name: category.name,
                group: category.group,
              },
            },
            criteriaSet: {
              id: criteriaSet.id,
              name: criteriaSet.name,
              source: criteriaSet.source,
              version: criteriaSet.version,
              sourceHash: criteriaSet.sourceHash,
            },
            judge: {
              id: judge.id,
              fullName: judge.fullName,
              organizationUnit: judge.organizationUnit,
            },
            assignedCriterionIds: allCriterionIds,
            scores: chosen.map((item) => ({
              criterion: {
                id: item.criterion.id,
                code: item.criterion.code,
                name: item.criterion.name,
              },
              subCriterion: {
                id: item.sub.id,
                code: item.sub.code,
                content: item.sub.content,
              },
              option: {
                id: item.option.id,
                label: item.option.label,
                points: item.option.points,
              },
              note: item.note,
            })),
            total,
          } as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull;

      return {
        chosen,
        total,
        criterionTotals,
        submissionSnapshot,
      };
    };

    if (spec.status === ProductStatus.COMPLETED && completedAt && scoringAt) {
      const eval1 = buildJudgeScores(judge1, 0, true, scoringAt);
      const eval2 = buildJudgeScores(judge2, 1, true, completedAt);

      for (const [judge, evalData, submittedTime] of [
        [judge1, eval1, scoringAt],
        [judge2, eval2, completedAt],
      ] as const) {
        const evaluation = await prisma.evaluation.upsert({
          where: {
            judgeId_productId: { judgeId: judge.id, productId: spec.id },
          },
          update: {
            status: EvaluationStatus.SUBMITTED,
            total: evalData.total,
            submittedAt: submittedTime,
            submissionSnapshot: evalData.submissionSnapshot,
          },
          create: {
            judgeId: judge.id,
            productId: spec.id,
            status: EvaluationStatus.SUBMITTED,
            total: evalData.total,
            submittedAt: submittedTime,
            submissionSnapshot: evalData.submissionSnapshot,
            createdAt: scoringAt,
          },
        });
        await prisma.score.deleteMany({
          where: { evaluationId: evaluation.id },
        });
        await prisma.score.createMany({
          data: evalData.chosen.map((item) => ({
            evaluationId: evaluation.id,
            subCriterionId: item.sub.id,
            optionId: item.option.id,
            note: item.note,
          })),
        });
      }

      const finalScore = calculateFinalScore(
        [
          { total: eval1.total, criterionTotals: eval1.criterionTotals },
          { total: eval2.total, criterionTotals: eval2.criterionTotals },
        ],
        allCriterionIds,
      );
      const starRating =
        finalScore !== null ? calculateStars(finalScore) : null;

      await prisma.product.update({
        where: { id: spec.id },
        data: { finalScore, starRating },
      });
    } else if (spec.status === ProductStatus.SCORING && scoringAt) {
      if (spec.scoringMode === 'one_submitted_one_draft') {
        const eval1 = buildJudgeScores(judge1, 0, true, scoringAt);
        const eval2 = buildJudgeScores(
          judge2,
          1,
          false,
          scoringAt,
          Math.max(1, Math.floor(flatSubs.length / 2)),
        );

        const row1 = await prisma.evaluation.upsert({
          where: {
            judgeId_productId: { judgeId: judge1.id, productId: spec.id },
          },
          update: {
            status: EvaluationStatus.SUBMITTED,
            total: eval1.total,
            submittedAt: scoringAt,
            submissionSnapshot: eval1.submissionSnapshot,
          },
          create: {
            judgeId: judge1.id,
            productId: spec.id,
            status: EvaluationStatus.SUBMITTED,
            total: eval1.total,
            submittedAt: scoringAt,
            submissionSnapshot: eval1.submissionSnapshot,
            createdAt: scoringAt,
          },
        });
        await prisma.score.deleteMany({ where: { evaluationId: row1.id } });
        await prisma.score.createMany({
          data: eval1.chosen.map((item) => ({
            evaluationId: row1.id,
            subCriterionId: item.sub.id,
            optionId: item.option.id,
            note: item.note,
          })),
        });

        const row2 = await prisma.evaluation.upsert({
          where: {
            judgeId_productId: { judgeId: judge2.id, productId: spec.id },
          },
          update: {
            status: EvaluationStatus.IN_PROGRESS,
            total: null,
            submittedAt: null,
            submissionSnapshot: Prisma.DbNull,
          },
          create: {
            judgeId: judge2.id,
            productId: spec.id,
            status: EvaluationStatus.IN_PROGRESS,
            createdAt: scoringAt,
          },
        });
        await prisma.score.deleteMany({ where: { evaluationId: row2.id } });
        await prisma.score.createMany({
          data: eval2.chosen.map((item) => ({
            evaluationId: row2.id,
            subCriterionId: item.sub.id,
            optionId: item.option.id,
            note: item.note,
          })),
        });
      } else {
        const eval1 = buildJudgeScores(
          judge1,
          0,
          false,
          scoringAt,
          Math.max(1, Math.floor(flatSubs.length / 2)),
        );
        const row1 = await prisma.evaluation.upsert({
          where: {
            judgeId_productId: { judgeId: judge1.id, productId: spec.id },
          },
          update: {
            status: EvaluationStatus.IN_PROGRESS,
            total: null,
            submittedAt: null,
            submissionSnapshot: Prisma.DbNull,
          },
          create: {
            judgeId: judge1.id,
            productId: spec.id,
            status: EvaluationStatus.IN_PROGRESS,
            createdAt: scoringAt,
          },
        });
        await prisma.score.deleteMany({ where: { evaluationId: row1.id } });
        await prisma.score.createMany({
          data: eval1.chosen.map((item) => ({
            evaluationId: row1.id,
            subCriterionId: item.sub.id,
            optionId: item.option.id,
            note: item.note,
          })),
        });
      }
    }
  }
}
