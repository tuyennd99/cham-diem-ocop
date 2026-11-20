import { AttachmentType, Prisma } from '@prisma/client';
import type { ManagingAgencySummary } from '@ocop/shared';

export type AdminRequestMeta = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

export const adminProductSelect = {
  id: true,
  codeNumber: true,
  name: true,
  description: true,
  status: true,
  publicationState: true,
  publishedFinalScore: true,
  publishedStarRating: true,
  publishedAt: true,
  returnReason: true,
  returnedAt: true,
  approvedAt: true,
  finalScore: true,
  starRating: true,
  createdAt: true,
  submittedAt: true,
  completedAt: true,
  localityId: true,
  formData: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  registrant: { select: { id: true, fullName: true, email: true } },
  locality: {
    select: { id: true, code: true, name: true, provinceName: true },
  },
  attachments: {
    where: { type: AttachmentType.IMAGE },
    select: { id: true, type: true, fileName: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

export const adminProductDetailSelect = {
  ...adminProductSelect,
  registrationSnapshot: true,
  requiredAgencySnapshot: true,
  registrant: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  returnedBy: { select: { id: true, fullName: true } },
  publishedBy: { select: { id: true, fullName: true } },
  category: {
    select: {
      id: true,
      name: true,
      agencyLinks: {
        orderBy: [
          { agency: { order: 'asc' as const } },
          { agency: { code: 'asc' as const } },
        ],
        select: {
          agency: {
            select: {
              id: true,
              code: true,
              name: true,
              order: true,
              isActive: true,
            },
          },
        },
      },
    },
  },
  locality: {
    select: {
      id: true,
      code: true,
      name: true,
      provinceName: true,
      eventName: true,
      effectiveFrom: true,
      effectiveTo: true,
      registrationFrom: true,
      registrationTo: true,
      isActive: true,
    },
  },
  attachments: {
    select: { id: true, type: true, fileName: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
  judgeAssignments: {
    orderBy: [
      { isActive: 'desc' as const },
      { assignedAt: 'asc' as const },
      { id: 'asc' as const },
    ],
    select: {
      id: true,
      productId: true,
      judgeId: true,
      managingAgencyId: true,
      organizationUnitId: true,
      isManual: true,
      isActive: true,
      mustSubmitToComplete: true,
      assignedAt: true,
      assignedBy: { select: { id: true, fullName: true } },
      removedAt: true,
      removedBy: { select: { id: true, fullName: true } },
      removeReason: true,
      judge: {
        select: {
          id: true,
          fullName: true,
          email: true,
          isActive: true,
          organizationUnit: {
            select: {
              id: true,
              code: true,
              name: true,
              managingAgencyId: true,
              managingAgency: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  order: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
      managingAgency: {
        select: {
          id: true,
          code: true,
          name: true,
          order: true,
          isActive: true,
        },
      },
    },
  },
  evaluations: {
    select: {
      id: true,
      judgeId: true,
      status: true,
      previousStatus: true,
      total: true,
      submittedAt: true,
      excludedAt: true,
      excludeReason: true,
      reopenedAt: true,
      reopenReason: true,
      scores: { select: { subCriterionId: true } },
    },
  },
  resultHistory: {
    orderBy: [{ createdAt: 'desc' as const }],
    select: {
      id: true,
      action: true,
      finalScore: true,
      starRating: true,
      isCurrent: true,
      actor: { select: { id: true, fullName: true } },
      reason: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ProductSelect;

export function parseSnapshotAgencies(
  raw: Prisma.JsonValue,
): ManagingAgencySummary[] {
  if (!Array.isArray(raw)) return [];
  const items: ManagingAgencySummary[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const rec = entry as Record<string, unknown>;
    if (
      typeof rec.id === 'string' &&
      typeof rec.code === 'string' &&
      typeof rec.name === 'string'
    ) {
      items.push({
        id: rec.id,
        code: rec.code,
        name: rec.name,
        order: typeof rec.order === 'number' ? rec.order : 0,
        isActive: typeof rec.isActive === 'boolean' ? rec.isActive : true,
      });
    }
  }
  return items;
}

export function escapeSqlLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
