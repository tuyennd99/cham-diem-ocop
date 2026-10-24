import type {
  AdminCriteriaSetDetail,
  BlankCriteriaPrintData,
  EvaluationPrintCriterionRow,
  EvaluationPrintData,
  EvaluationRecordStatus,
  LocalityType,
  ProductApplicationForm,
  ProductResultsPrintData,
  ProductStatus,
  RegistrationPrintData,
  RegistrationSnapshotV1,
  ScoreOption,
} from '@ocop/shared';
import { productRegistrationTypes } from '../constants/products';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function extractSafeApplicationForm(
  value: unknown,
): Partial<ProductApplicationForm> {
  const source = asRecord(value);
  if (!source) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const field of [
    'entityName',
    'representativeName',
    'representativeTitle',
    'contactAddress',
    'provinceName',
    'phone',
    'email',
  ]) {
    if (typeof source[field] === 'string') {
      result[field] = source[field] as string;
    }
  }
  if (
    typeof source.registrationType === 'string' &&
    (productRegistrationTypes as readonly string[]).includes(
      source.registrationType,
    )
  ) {
    result.registrationType = source.registrationType;
  }
  if (
    typeof source.sampleQuantity === 'number' &&
    Number.isInteger(source.sampleQuantity) &&
    source.sampleQuantity >= 0 &&
    source.sampleQuantity <= 100000
  ) {
    result.sampleQuantity = source.sampleQuantity;
  }
  if (
    typeof source.assessmentYear === 'number' &&
    Number.isInteger(source.assessmentYear) &&
    source.assessmentYear >= 2020 &&
    source.assessmentYear <= 2100
  ) {
    result.assessmentYear = source.assessmentYear;
  }
  if (typeof source.declarationAccepted === 'boolean') {
    result.declarationAccepted = source.declarationAccepted;
  }
  return result as Partial<ProductApplicationForm>;
}

export function formatStarPrintLabel(
  finalScore: number | null | undefined,
  starRating: number | null | undefined,
): string | null {
  if (
    typeof finalScore !== 'number' ||
    !Number.isFinite(finalScore) ||
    typeof starRating !== 'number'
  ) {
    return null;
  }
  if (starRating === 5) {
    return 'Mức điểm 5 sao / Đề nghị xem xét 5 sao';
  }
  return `Mức điểm ${starRating} sao`;
}

export function buildBlankCriteriaPrintData(
  criteriaSet: AdminCriteriaSetDetail,
  generatedAt = new Date(),
): BlankCriteriaPrintData {
  return {
    kind: 'BLANK_CRITERIA',
    generatedAt: generatedAt.toISOString(),
    criteriaSet,
  };
}

interface CatalogCriterionInput {
  id: string;
  code: string;
  name: string;
  maxScore: number;
  order: number;
  sectionCode: string;
  sectionName: string;
  subCriteria: Array<{
    id: string;
    code: string;
    content: string;
    order: number;
    options: ScoreOption[];
  }>;
}

export interface EvaluationPrintBuildInput {
  generatedAt?: Date;
  evaluationId: string | null;
  status: EvaluationRecordStatus;
  submittedAt: Date | null;
  total: number | null;
  assignedCriterionIds: string[];
  submissionSnapshot: unknown;
  currentProduct: {
    id: string;
    name: string;
    formData: unknown;
    category: {
      id: string;
      name: string;
      groupName: string;
      criteriaSet: {
        id: string;
        name: string | null;
        source: string | null;
        version: string;
        sourceHash: string | null;
        criteria: CatalogCriterionInput[];
      } | null;
    };
  };
  currentJudge: {
    id: string;
    fullName: string;
    organizationUnit: { name: string } | null;
  };
  liveScores: Array<{
    subCriterionId: string;
    optionId: string;
    note: string | null;
    option: { id: string; label: string; points: number };
    subCriterion?: {
      id: string;
      code: string;
      content: string;
      criterion: { id: string; code: string; name: string };
    };
  }>;
}

interface ParsedSnapshotScore {
  subCriterionId: string;
  subCriterionCode?: string;
  subCriterionContent?: string;
  criterionId: string;
  criterionCode?: string;
  criterionName?: string;
  criterionMaxScore?: number;
  sectionCode?: string;
  sectionName?: string;
  optionId: string | null;
  optionLabel: string;
  points: number;
  note: string | null;
}

function parseEvaluationSnapshot(raw: unknown) {
  const snap = asRecord(raw);
  if (!snap) return null;
  const isV1 = snap.version === 1;
  const isPreUpgrade =
    snap.schemaVersion === 1 && snap.provenance === 'PRE_UPGRADE';
  if (!isV1 && !isPreUpgrade) return null;

  const judgeRec = asRecord(snap.judge);
  const unitRec = asRecord(judgeRec?.organizationUnit);
  const productRec = asRecord(snap.product);
  const catRec = asRecord(productRec?.category);
  const groupRec = asRecord(catRec?.group);
  const csRec = asRecord(snap.criteriaSet);
  const scopeRec = asRecord(snap.scope);

  const rawAssignedIds = Array.isArray(snap.assignedCriterionIds)
    ? snap.assignedCriterionIds
    : Array.isArray(scopeRec?.criterionIds)
      ? scopeRec.criterionIds
      : [];
  const assignedCriterionIds = rawAssignedIds.filter(
    (id): id is string => typeof id === 'string',
  );

  const scores: ParsedSnapshotScore[] = [];
  if (Array.isArray(snap.scores)) {
    for (const item of snap.scores) {
      const row = asRecord(item);
      if (!row) continue;
      const crit = asRecord(row.criterion);
      const sub = asRecord(row.subCriterion);
      const opt = asRecord(row.option);
      const subCriterionId =
        asString(sub?.id) ?? asString(row.subCriterionId) ?? '';
      const criterionId = asString(crit?.id) ?? '';
      const points =
        typeof opt?.points === 'number'
          ? opt.points
          : typeof row.points === 'number'
            ? row.points
            : 0;
      if (!subCriterionId || !criterionId) continue;
      scores.push({
        subCriterionId,
        subCriterionCode: asString(sub?.code) ?? undefined,
        subCriterionContent: asString(sub?.content) ?? undefined,
        criterionId,
        criterionCode: asString(crit?.code) ?? undefined,
        criterionName: asString(crit?.name) ?? undefined,
        criterionMaxScore:
          typeof crit?.maxScore === 'number' ? crit.maxScore : undefined,
        sectionCode: asString(crit?.sectionCode) ?? undefined,
        sectionName: asString(crit?.sectionName) ?? undefined,
        optionId: asString(opt?.id) ?? asString(row.optionId),
        optionLabel: asString(opt?.label) ?? `${points} điểm`,
        points,
        note: asString(row.note),
      });
    }
  }

  const formRec = extractSafeApplicationForm(productRec?.formData);

  return {
    provenance: (isPreUpgrade ? 'PRE_UPGRADE' : 'SNAPSHOT_V1') as
      | 'PRE_UPGRADE'
      | 'SNAPSHOT_V1',
    historicalValuesVerified: isPreUpgrade
      ? Boolean(snap.historicalValuesVerified)
      : true,
    submittedAt: asString(snap.submittedAt),
    total: typeof snap.total === 'number' ? snap.total : null,
    assignedCriterionIds,
    judge: {
      id: asString(judgeRec?.id),
      fullName: asString(judgeRec?.fullName),
      organizationUnitName: asString(unitRec?.name),
    },
    product: {
      name: asString(productRec?.name),
      entityName: asString(formRec.entityName),
      categoryName: asString(catRec?.name),
      groupName: asString(groupRec?.name),
    },
    criteriaSet: {
      id: asString(csRec?.id),
      name: asString(csRec?.name),
      source: asString(csRec?.source),
      version: asString(csRec?.version),
      sourceHash: asString(csRec?.sourceHash),
    },
    scores,
  };
}

export function buildEvaluationPrintData(
  input: EvaluationPrintBuildInput,
): EvaluationPrintData {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const isDraft = input.status !== 'SUBMITTED';
  const parsedSnap = !isDraft
    ? parseEvaluationSnapshot(input.submissionSnapshot)
    : null;

  const catalogSet = input.currentProduct.category.criteriaSet;
  const catalogCriteria = catalogSet?.criteria ?? [];
  const allCatalogCriterionIds = catalogCriteria.map((c) => c.id);

  const effectiveAssignedIds = parsedSnap
    ? parsedSnap.assignedCriterionIds.length > 0
      ? parsedSnap.assignedCriterionIds
      : allCatalogCriterionIds
    : input.assignedCriterionIds.length > 0
      ? input.assignedCriterionIds
      : allCatalogCriterionIds;

  const assignedSet = new Set(effectiveAssignedIds);

  const snapScoreBySub = new Map(
    (parsedSnap?.scores ?? []).map((s) => [s.subCriterionId, s]),
  );
  const snapCriterionMeta = new Map(
    (parsedSnap?.scores ?? []).map((s) => [
      s.criterionId,
      {
        code: s.criterionCode,
        name: s.criterionName,
        maxScore: s.criterionMaxScore,
        sectionCode: s.sectionCode,
        sectionName: s.sectionName,
      },
    ]),
  );
  const liveScoreBySub = new Map(
    input.liveScores.map((s) => [s.subCriterionId, s]),
  );

  const criteriaRows: EvaluationPrintCriterionRow[] = [];

  if (catalogCriteria.length > 0) {
    for (const criterion of catalogCriteria) {
      const inScope =
        assignedSet.size === 0 || assignedSet.has(criterion.id);
      const snapMeta = snapCriterionMeta.get(criterion.id);
      const subRows = criterion.subCriteria.map((sub) => {
        const maxPoints = sub.options.length
          ? Math.max(...sub.options.map((o) => o.points))
          : 0;
        if (!inScope) {
          return {
            subCriterionId: sub.id,
            code: sub.code,
            content: sub.content,
            maxPoints,
            selectedOptionId: null,
            selectedLabel: null,
            points: null,
            note: null,
            options: sub.options,
          };
        }
        if (parsedSnap) {
          const snapScore = snapScoreBySub.get(sub.id);
          return {
            subCriterionId: sub.id,
            code: snapScore?.subCriterionCode ?? sub.code,
            content: snapScore?.subCriterionContent ?? sub.content,
            maxPoints,
            selectedOptionId: snapScore?.optionId ?? null,
            selectedLabel: snapScore?.optionLabel ?? null,
            points: snapScore ? snapScore.points : null,
            note: snapScore?.note ?? null,
            options: sub.options,
          };
        }
        const live = liveScoreBySub.get(sub.id);
        return {
          subCriterionId: sub.id,
          code: sub.code,
          content: sub.content,
          maxPoints,
          selectedOptionId: live?.optionId ?? null,
          selectedLabel: live?.option.label ?? null,
          points: live ? live.option.points : null,
          note: live?.note ?? null,
          options: sub.options,
        };
      });

      criteriaRows.push({
        criterionId: criterion.id,
        code: snapMeta?.code ?? criterion.code,
        name: snapMeta?.name ?? criterion.name,
        sectionCode: snapMeta?.sectionCode ?? criterion.sectionCode,
        sectionName: snapMeta?.sectionName ?? criterion.sectionName,
        maxScore: criterion.maxScore,
        inScope,
        subCriteria: subRows,
      });
    }
  } else if (parsedSnap) {
    const byCrit = new Map<string, ParsedSnapshotScore[]>();
    for (const score of parsedSnap.scores) {
      const list = byCrit.get(score.criterionId) ?? [];
      list.push(score);
      byCrit.set(score.criterionId, list);
    }
    for (const [criterionId, list] of byCrit.entries()) {
      const first = list[0];
      const maxScore =
        first.criterionMaxScore ??
        list.reduce((sum, item) => sum + item.points, 0);
      criteriaRows.push({
        criterionId,
        code: first.criterionCode ?? criterionId,
        name: first.criterionName ?? criterionId,
        sectionCode: first.sectionCode ?? 'A',
        sectionName: first.sectionName ?? 'Tiêu chí đánh giá',
        maxScore,
        inScope: true,
        subCriteria: list.map((item) => ({
          subCriterionId: item.subCriterionId,
          code: item.subCriterionCode ?? item.subCriterionId,
          content: item.subCriterionContent ?? '',
          maxPoints: item.points,
          selectedOptionId: item.optionId,
          selectedLabel: item.optionLabel,
          points: item.points,
          note: item.note,
          options: item.optionId
            ? [
                {
                  id: item.optionId,
                  label: item.optionLabel,
                  points: item.points,
                },
              ]
            : [],
        })),
      });
    }
  }

  const scopeMaxScore = criteriaRows
    .filter((c) => c.inScope)
    .reduce((sum, c) => sum + c.maxScore, 0);

  const computedTotal = criteriaRows
    .filter((c) => c.inScope)
    .flatMap((c) => c.subCriteria)
    .reduce((sum, sub) => sum + (sub.points ?? 0), 0);

  const total =
    parsedSnap?.total ??
    (typeof input.total === 'number' ? input.total : computedTotal);

  const isPartialScope =
    criteriaRows.length > 0 && criteriaRows.some((c) => !c.inScope);

  const currentForm = extractSafeApplicationForm(input.currentProduct.formData);

  return {
    kind: 'EVALUATION',
    generatedAt,
    evaluationId: input.evaluationId,
    status: input.status,
    isDraft,
    provenance: parsedSnap ? parsedSnap.provenance : 'LIVE_DRAFT',
    historicalValuesVerified: parsedSnap
      ? parsedSnap.historicalValuesVerified
      : !isDraft,
    submittedAt:
      parsedSnap?.submittedAt ?? input.submittedAt?.toISOString() ?? null,
    product: {
      id: input.currentProduct.id,
      name: parsedSnap?.product.name ?? input.currentProduct.name,
      categoryName:
        parsedSnap?.product.categoryName ?? input.currentProduct.category.name,
      groupName:
        parsedSnap?.product.groupName ??
        input.currentProduct.category.groupName,
      entityName:
        parsedSnap?.product.entityName ?? currentForm.entityName ?? null,
    },
    judge: {
      id: parsedSnap?.judge.id ?? input.currentJudge.id,
      fullName: parsedSnap?.judge.fullName ?? input.currentJudge.fullName,
      organizationUnitName: parsedSnap
        ? parsedSnap.judge.organizationUnitName
        : (input.currentJudge.organizationUnit?.name ?? null),
    },
    criteriaSet: {
      id: parsedSnap?.criteriaSet.id ?? catalogSet?.id ?? '',
      name: parsedSnap?.criteriaSet.name ?? catalogSet?.name ?? null,
      source: parsedSnap?.criteriaSet.source ?? catalogSet?.source ?? null,
      version: parsedSnap?.criteriaSet.version ?? catalogSet?.version ?? null,
      sourceHash:
        parsedSnap?.criteriaSet.sourceHash ?? catalogSet?.sourceHash ?? null,
    },
    isPartialScope,
    total,
    scopeMaxScore,
    criteria: criteriaRows,
  };
}

function parseRegistrationSnapshot(raw: unknown): RegistrationSnapshotV1 | null {
  const snap = asRecord(raw);
  if (!snap || snap.version !== 1) return null;
  const prod = asRecord(snap.product);
  const reg = asRecord(snap.registrant);
  const cat = asRecord(snap.category);
  const grp = asRecord(cat?.group);
  const loc = asRecord(snap.locality);
  if (!prod || !reg || !cat || !grp || !loc) return null;
  return snap as unknown as RegistrationSnapshotV1;
}

export function buildRegistrationPrintData(input: {
  generatedAt?: Date;
  product: {
    id: string;
    name: string;
    description: string | null;
    status: ProductStatus;
    submittedAt: Date | null;
    createdAt: Date;
    localityCodeAtSubmit?: string | null;
    localityNameAtSubmit?: string | null;
    localityTypeAtSubmit?: LocalityType | null;
    provinceNameAtSubmit?: string | null;
    formData: unknown;
    registrationSnapshot: unknown;
    registrant: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
    };
    category: {
      id: string;
      name: string;
      groupName: string;
      classificationGroup: string;
      classificationSubgroup: string | null;
    };
    locality: {
      id: string;
      code: string;
      name: string;
      type: LocalityType;
      provinceName: string;
    } | null;
    attachments: Array<{
      id: string;
      type: 'IMAGE' | 'EVIDENCE';
      fileName: string;
      createdAt: Date;
    }>;
  };
}): RegistrationPrintData {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const { product } = input;
  const isDraft = product.status === 'DRAFT';
  const snap = !isDraft
    ? parseRegistrationSnapshot(product.registrationSnapshot)
    : null;

  const fallbackLocality =
    !isDraft && product.localityNameAtSubmit
      ? {
          id: product.locality?.id ?? '',
          code: product.localityCodeAtSubmit ?? product.locality?.code ?? '',
          name: product.localityNameAtSubmit,
          type:
            product.localityTypeAtSubmit ??
            product.locality?.type ??
            ('COMMUNE' as LocalityType),
          provinceName:
            product.provinceNameAtSubmit ??
            product.locality?.provinceName ??
            '',
        }
      : product.locality;

  return {
    kind: 'REGISTRATION',
    generatedAt,
    isDraft,
    hasSubmissionSnapshot: Boolean(snap),
    product: {
      id: product.id,
      name: snap ? snap.product.name : product.name,
      description: snap ? snap.product.description : product.description,
      status: product.status,
      submittedAt:
        snap?.submittedAt ?? product.submittedAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString(),
    },
    registrant: snap
      ? snap.registrant
      : {
          id: product.registrant.id,
          fullName: product.registrant.fullName,
          email: product.registrant.email,
          phone: product.registrant.phone,
        },
    category: snap
      ? {
          id: snap.category.id,
          name: snap.category.name,
          groupName: snap.category.group.name,
          classificationGroup: snap.category.classificationGroup,
          classificationSubgroup: snap.category.classificationSubgroup,
        }
      : product.category,
    locality: snap ? snap.locality : fallbackLocality,
    formData: snap
      ? extractSafeApplicationForm(snap.formData)
      : extractSafeApplicationForm(product.formData),
    attachments: product.attachments.map((att) => ({
      id: att.id,
      type: att.type,
      fileName: att.fileName,
      createdAt: att.createdAt.toISOString(),
    })),
  };
}

export function buildProductResultsPrintData(input: {
  generatedAt?: Date;
  product: {
    id: string;
    name: string;
    status: ProductStatus;
    submittedAt: Date | null;
    completedAt: Date | null;
    finalScore: number | null;
    starRating: number | null;
    localityNameAtSubmit: string | null;
    provinceNameAtSubmit: string | null;
    formData: unknown;
    registrationSnapshot: unknown;
    locality: { name: string; provinceName: string } | null;
    category: {
      id: string;
      name: string;
      groupName: string;
      criteriaSet: {
        id: string;
        name: string | null;
        source: string | null;
        version: string;
        criteria: Array<{
          id: string;
          code: string;
          name: string;
          maxScore: number;
        }>;
      } | null;
    };
    assignments: Array<{ judgeId: string; criterionIds: string[] }>;
    evaluations: Array<{
      id: string;
      judgeId: string;
      status: EvaluationRecordStatus;
      total: number | null;
      submittedAt: Date | null;
      submissionSnapshot: unknown;
      judge: {
        id: string;
        fullName: string;
        organizationUnit: { name: string } | null;
      };
      scores: Array<{
        subCriterion: { criterionId: string };
        option: { points: number };
      }>;
    }>;
  };
}): ProductResultsPrintData {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const { product } = input;
  const regSnap = parseRegistrationSnapshot(product.registrationSnapshot);
  const safeForm = regSnap
    ? extractSafeApplicationForm(regSnap.formData)
    : extractSafeApplicationForm(product.formData);

  const isCompleted = product.status === 'COMPLETED';
  const finalScore = isCompleted ? product.finalScore : null;
  const starRating = isCompleted ? product.starRating : null;
  const starLabel = formatStarPrintLabel(finalScore, starRating);

  const criteriaList = product.category.criteriaSet?.criteria ?? [];
  const allCriterionIds = criteriaList.map((c) => c.id);
  const assignmentByJudge = new Map(
    product.assignments.map((a) => [a.judgeId, a.criterionIds]),
  );

  const evaluationRows = product.evaluations.map((evaluation) => {
    const parsedSnap =
      evaluation.status === 'SUBMITTED'
        ? parseEvaluationSnapshot(evaluation.submissionSnapshot)
        : null;

    const assignedIds = parsedSnap
      ? parsedSnap.assignedCriterionIds.length > 0
        ? parsedSnap.assignedCriterionIds
        : allCriterionIds
      : (assignmentByJudge.get(evaluation.judgeId)?.length ?? 0) > 0
        ? assignmentByJudge.get(evaluation.judgeId)!
        : allCriterionIds;

    const assignedSet = new Set(assignedIds);
    const isPartialScope =
      allCriterionIds.length > 0 &&
      allCriterionIds.some((id) => !assignedSet.has(id));
    const scopeMaxScore = criteriaList
      .filter((c) => assignedSet.size === 0 || assignedSet.has(c.id))
      .reduce((sum, c) => sum + c.maxScore, 0);

    const criterionScores: Record<string, number | null> = {};
    for (const c of criteriaList) {
      criterionScores[c.id] = null;
    }

    if (parsedSnap && parsedSnap.scores.length > 0) {
      for (const s of parsedSnap.scores) {
        if (assignedSet.size === 0 || assignedSet.has(s.criterionId)) {
          criterionScores[s.criterionId] =
            (criterionScores[s.criterionId] ?? 0) + s.points;
        }
      }
    } else {
      for (const s of evaluation.scores) {
        const cId = s.subCriterion.criterionId;
        if (assignedSet.size === 0 || assignedSet.has(cId)) {
          criterionScores[cId] = (criterionScores[cId] ?? 0) + s.option.points;
        }
      }
    }

    return {
      id: evaluation.id,
      judgeId: evaluation.judgeId,
      judgeName: parsedSnap?.judge.fullName ?? evaluation.judge.fullName,
      organizationUnitName: parsedSnap
        ? parsedSnap.judge.organizationUnitName
        : (evaluation.judge.organizationUnit?.name ?? null),
      status: evaluation.status,
      submittedAt:
        parsedSnap?.submittedAt ?? evaluation.submittedAt?.toISOString() ?? null,
      isPartialScope,
      total: parsedSnap?.total ?? evaluation.total,
      scopeMaxScore,
      criterionScores,
    };
  });

  const submittedRows = evaluationRows.filter((r) => r.status === 'SUBMITTED');
  const criteriaSummary = criteriaList.map((criterion) => {
    const scores = submittedRows
      .map((row) => row.criterionScores[criterion.id])
      .filter((val): val is number => typeof val === 'number');
    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, v) => sum + v, 0) / scores.length
        : null;
    return {
      criterionId: criterion.id,
      code: criterion.code,
      name: criterion.name,
      maxScore: criterion.maxScore,
      averageScore,
    };
  });

  return {
    kind: 'PRODUCT_RESULTS',
    generatedAt,
    product: {
      id: product.id,
      name: regSnap ? regSnap.product.name : product.name,
      status: product.status,
      submittedAt:
        regSnap?.submittedAt ?? product.submittedAt?.toISOString() ?? null,
      completedAt: product.completedAt?.toISOString() ?? null,
      entityName: safeForm.entityName ?? null,
      localityName:
        regSnap?.locality.name ??
        product.localityNameAtSubmit ??
        product.locality?.name ??
        null,
      provinceName:
        regSnap?.locality.provinceName ??
        product.provinceNameAtSubmit ??
        product.locality?.provinceName ??
        null,
      categoryName: regSnap ? regSnap.category.name : product.category.name,
      groupName: regSnap
        ? regSnap.category.group.name
        : product.category.groupName,
      finalScore,
      starRating,
      starLabel,
    },
    criteriaSet: product.category.criteriaSet
      ? {
          id: product.category.criteriaSet.id,
          name: product.category.criteriaSet.name,
          source: product.category.criteriaSet.source,
          version: product.category.criteriaSet.version,
        }
      : null,
    evaluations: evaluationRows,
    criteriaSummary,
  };
}
