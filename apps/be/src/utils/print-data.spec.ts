import {
  buildEvaluationPrintData,
  buildProductResultsPrintData,
  buildRegistrationPrintData,
  formatStarPrintLabel,
} from './print-data';

describe('print-data builders', () => {
  it('labels 5-star scores as proposed 5-star consideration and keeps 89.99 at 4 stars', () => {
    expect(formatStarPrintLabel(89.99, 4)).toBe('Mức điểm 4 sao');
    expect(formatStarPrintLabel(90, 5)).toBe(
      'Mức điểm 5 sao / Đề nghị xem xét 5 sao',
    );
    expect(formatStarPrintLabel(null, null)).toBeNull();
  });

  it.each([1, 2])('builds evaluation print data from version %i submissionSnapshot and marks out-of-scope criteria', (version) => {
    const result = buildEvaluationPrintData({
      generatedAt: new Date('2026-10-24T08:00:00.000Z'),
      evaluationId: 'eval-1',
      status: 'SUBMITTED',
      submittedAt: new Date('2026-10-20T09:00:00.000Z'),
      total: 50,
      assignedCriterionIds: ['crit-a'],
      submissionSnapshot: {
        version,
        submittedAt: '2026-10-20T09:00:00.000Z',
        product: {
          id: 'prod-1',
          name: 'Trà Shan Tuyết cổ thụ',
          description: null,
          formData: { entityName: 'HTX Trà vùng cao' },
          category: {
            id: 'cat-1',
            name: 'Chè tươi, chè chế biến',
            ...(version === 1 ? { group: { id: 'grp-food', code: 'FOOD', name: 'Sản phẩm thực phẩm' } } : {}),
          },
        },
        criteriaSet: {
          id: 'set-1',
          name: 'Bộ tiêu chí Chè',
          source: 'QĐ 26/2026/QĐ-TTg',
          version: '1',
          sourceHash: 'abc123',
        },
        judge: {
          id: 'judge-1',
          fullName: 'Nguyễn Văn Giám Khảo (Lúc nộp)',
          organizationUnit: {
            id: 'unit-1',
            code: 'SNN',
            name: 'Sở Nông nghiệp (Lúc nộp)',
          },
        },
        assignedCriterionIds: ['crit-a'],
        scores: [
          {
            criterion: { id: 'crit-a', code: 'A1', name: 'Tổ chức sản xuất' },
            subCriterion: {
              id: 'sub-a1',
              code: 'A1.1',
              content: 'Nguồn nguyên liệu địa phương',
            },
            option: { id: 'opt-a1-2', label: 'Ổn định ≥ 75%', points: 50 },
            note: 'Đạt chuẩn vùng nguyên liệu',
          },
        ],
        total: 50,
      },
      currentProduct: {
        id: 'prod-1',
        name: 'Tên mới sau khi đổi',
        formData: { entityName: 'Tên chủ thể mới' },
        category: {
          id: 'cat-1',
          name: 'Danh mục đổi tên',
          criteriaSet: {
            id: 'set-1',
            name: 'Bộ đổi tên',
            source: 'Nguồn mới',
            version: '2',
            sourceHash: 'hash-new',
            criteria: [
              {
                id: 'crit-a',
                code: 'A1',
                name: 'Tổ chức sản xuất (mới)',
                maxScore: 60,
                order: 1,
                sectionCode: 'A',
                sectionName: 'Phần A',
                subCriteria: [
                  {
                    id: 'sub-a1',
                    code: 'A1.1',
                    content: 'Nội dung mới',
                    order: 1,
                    options: [
                      { id: 'opt-a1-1', label: 'Thấp', points: 25 },
                      { id: 'opt-a1-2', label: 'Cao', points: 60 },
                    ],
                  },
                ],
              },
              {
                id: 'crit-b',
                code: 'B1',
                name: 'Tiếp thị',
                maxScore: 40,
                order: 2,
                sectionCode: 'B',
                sectionName: 'Phần B',
                subCriteria: [
                  {
                    id: 'sub-b1',
                    code: 'B1.1',
                    content: 'Bao bì',
                    order: 1,
                    options: [{ id: 'opt-b1-1', label: 'Đạt', points: 40 }],
                  },
                ],
              },
            ],
          },
        },
      },
      currentJudge: {
        id: 'judge-1',
        fullName: 'Tên giám khảo hiện tại',
        organizationUnit: { name: 'Đơn vị mới chuyển' },
      },
      liveScores: [],
    });

    expect(result.isDraft).toBe(false);
    expect(result.provenance).toBe(version === 1 ? 'SNAPSHOT_V1' : 'SNAPSHOT_V2');
    expect(result.product).not.toHaveProperty('groupName');
    expect(result.historicalValuesVerified).toBe(true);
    expect(result.judge.fullName).toBe('Nguyễn Văn Giám Khảo (Lúc nộp)');
    expect(result.judge.organizationUnitName).toBe('Sở Nông nghiệp (Lúc nộp)');
    expect(result.product.name).toBe('Trà Shan Tuyết cổ thụ');
    expect(result.product.entityName).toBe('HTX Trà vùng cao');
    expect(result.isPartialScope).toBe(true);
    expect(result.total).toBe(50);
    expect(result.scopeMaxScore).toBe(60);
    expect(result.criteria).toHaveLength(2);
    expect(result.criteria[0]).toMatchObject({
      criterionId: 'crit-a',
      name: 'Tổ chức sản xuất',
      inScope: true,
    });
    expect(result.criteria[0].subCriteria[0]).toMatchObject({
      code: 'A1.1',
      content: 'Nguồn nguyên liệu địa phương',
      selectedLabel: 'Ổn định ≥ 75%',
      points: 50,
      note: 'Đạt chuẩn vùng nguyên liệu',
    });
    expect(result.criteria[1]).toMatchObject({
      criterionId: 'crit-b',
      inScope: false,
    });
    expect(result.criteria[1].subCriteria[0].points).toBeNull();
  });

  it('builds evaluation print data from PRE_UPGRADE migration 0011 snapshot', () => {
    const result = buildEvaluationPrintData({
      generatedAt: new Date('2026-10-24T08:00:00.000Z'),
      evaluationId: 'eval-legacy',
      status: 'SUBMITTED',
      submittedAt: null,
      total: 80,
      assignedCriterionIds: [],
      submissionSnapshot: {
        schemaVersion: 1,
        provenance: 'PRE_UPGRADE',
        historicalValuesVerified: false,
        submittedAt: null,
        total: 80,
        judge: {
          id: 'judge-1',
          fullName: 'Giám khảo Cũ',
          organizationUnit: null,
        },
        product: { id: 'prod-1', categoryId: 'cat-1' },
        criteriaSet: {
          id: 'set-1',
          name: 'Bộ tiêu chí Cũ',
          source: 'QĐ 26/2026/QĐ-TTg',
          version: null,
          sourceHash: null,
        },
        scope: { criterionIds: ['crit-a'] },
        scores: [
          {
            subCriterionId: 'sub-a1',
            optionId: 'opt-a1-2',
            note: 'Ghi chú cũ',
            points: 80,
            criterion: {
              id: 'crit-a',
              code: 'A1',
              name: 'Tiêu chí A',
              maxScore: 100,
              sectionCode: 'A',
              sectionName: 'Phần A',
            },
            subCriterion: { code: 'A1.1', content: 'Tiểu tiêu chí A1.1' },
            option: { label: 'Mức tối đa', points: 80 },
          },
        ],
      },
      currentProduct: {
        id: 'prod-1',
        name: 'Sản phẩm Cũ',
        formData: { entityName: 'Chủ thể Cũ' },
        category: {
          id: 'cat-1',
          name: 'Chè',
          criteriaSet: null,
        },
      },
      currentJudge: {
        id: 'judge-1',
        fullName: 'Giám khảo đổi tên',
        organizationUnit: { name: 'Đơn vị mới' },
      },
      liveScores: [],
    });

    expect(result.provenance).toBe('PRE_UPGRADE');
    expect(result.historicalValuesVerified).toBe(false);
    expect(result.judge.fullName).toBe('Giám khảo Cũ');
    expect(result.judge.organizationUnitName).toBeNull();
    expect(result.total).toBe(80);
    expect(result.criteria[0].subCriteria[0].selectedLabel).toBe('Mức tối đa');
  });

  it.each([1, 2])('preserves version %i registrationSnapshot fields after catalog/locality renames', (version) => {
    const result = buildRegistrationPrintData({
      generatedAt: new Date('2026-10-24T08:00:00.000Z'),
      product: {
        id: 'prod-1',
        name: 'Tên hiện tại đã sửa',
        description: 'Mô tả hiện tại',
        status: 'SUBMITTED',
        submittedAt: new Date('2026-10-21T03:00:00.000Z'),
        createdAt: new Date('2026-10-20T01:00:00.000Z'),
        localityCodeAtSubmit: 'LOC-01',
        localityNameAtSubmit: 'Xã Cũ',
        localityTypeAtSubmit: 'COMMUNE',
        provinceNameAtSubmit: 'Tỉnh Cũ',
        formData: { entityName: 'Chủ thể hiện tại' },
        registrationSnapshot: {
          version,
          submittedAt: '2026-10-21T03:00:00.000Z',
          product: {
            id: 'prod-1',
            name: 'Tên sản phẩm lúc nộp',
            description: 'Mô tả lúc nộp',
          },
          registrant: {
            id: 'reg-1',
            fullName: 'Chủ thể lúc nộp',
            email: 'old@example.invalid',
            phone: '0900000001',
          },
          category: {
            id: 'cat-1',
            name: 'Phân loại lúc nộp',
            ...(version === 1 ? {
              classificationGroup: 'Nhóm con lúc nộp', classificationSubgroup: null,
              group: { id: 'grp-1', code: 'FOOD', name: 'Nhóm lớn lúc nộp' },
            } : {}),
          },
          locality: {
            id: 'loc-1',
            code: 'LOC-01',
            name: 'Xã lúc nộp',
            type: 'COMMUNE',
            provinceName: 'Tỉnh lúc nộp',
          },
          formData: {
            entityName: 'HTX lúc nộp',
            representativeName: 'Đại diện lúc nộp',
            representativeTitle: 'Giám đốc',
            contactAddress: 'Thôn 1',
            provinceName: 'Tỉnh lúc nộp',
            phone: '0900000001',
            registrationType: 'FIRST',
            sampleQuantity: 2,
            assessmentYear: 2026,
            declarationAccepted: true,
          },
        },
        registrant: {
          id: 'reg-1',
          fullName: 'Chủ thể đổi tên',
          email: 'new@example.invalid',
          phone: '0999999999',
        },
        category: {
          id: 'cat-1',
          name: 'Phân loại đổi tên',
        },
        locality: {
          id: 'loc-1',
          code: 'LOC-01',
          name: 'Xã đổi tên',
          type: 'COMMUNE',
          provinceName: 'Tỉnh đổi tên',
        },
        attachments: [
          {
            id: 'att-1',
            type: 'IMAGE',
            fileName: 'anh-san-pham.png',
            createdAt: new Date('2026-10-20T02:00:00.000Z'),
          },
        ],
      },
    });

    expect(result.isDraft).toBe(false);
    expect(result.hasSubmissionSnapshot).toBe(true);
    expect(result.product.name).toBe('Tên sản phẩm lúc nộp');
    expect(result.registrant.fullName).toBe('Chủ thể lúc nộp');
    expect(result.category).toEqual({ id: 'cat-1', name: 'Phân loại lúc nộp' });
    expect(result.locality?.name).toBe('Xã lúc nộp');
    expect(result.formData.entityName).toBe('HTX lúc nộp');
  });

  it('withholds finalScore and starRating in results print data when product is not COMPLETED', () => {
    const result = buildProductResultsPrintData({
      generatedAt: new Date('2026-10-24T08:00:00.000Z'),
      product: {
        id: 'prod-scoring',
        name: 'Sản phẩm đang chấm',
        status: 'SCORING',
        submittedAt: new Date('2026-10-21T03:00:00.000Z'),
        completedAt: null,
        finalScore: 92.5,
        starRating: 5,
        localityNameAtSubmit: 'Xã A',
        provinceNameAtSubmit: 'Tỉnh B',
        formData: { entityName: 'HTX A' },
        registrationSnapshot: null,
        locality: null,
        category: {
          id: 'cat-1',
          name: 'Chè',
          criteriaSet: {
            id: 'set-1',
            name: 'Bộ Chè',
            source: 'QĐ 26',
            version: '1',
            criteria: [
              { id: 'c1', code: 'A1', name: 'Tiêu chí 1', maxScore: 60 },
              { id: 'c2', code: 'B1', name: 'Tiêu chí 2', maxScore: 40 },
            ],
          },
        },
        assignments: [{ judgeId: 'judge-1', criterionIds: ['c1'] }],
        evaluations: [
          {
            id: 'eval-1',
            judgeId: 'judge-1',
            status: 'SUBMITTED',
            total: 50,
            submittedAt: new Date('2026-10-22T03:00:00.000Z'),
            submissionSnapshot: null,
            judge: {
              id: 'judge-1',
              fullName: 'Giám khảo 1',
              organizationUnit: { name: 'Sở NN' },
            },
            scores: [
              {
                subCriterion: { criterionId: 'c1' },
                option: { points: 50 },
              },
            ],
          },
        ],
      },
    });

    expect(result.product.finalScore).toBeNull();
    expect(result.product.starRating).toBeNull();
    expect(result.product.starLabel).toBeNull();
    expect(result.evaluations[0]).toMatchObject({
      judgeName: 'Giám khảo 1',
      isPartialScope: true,
      total: 50,
      scopeMaxScore: 60,
    });
  });
});
