import { Prisma, Role, StaffPermission } from '@prisma/client';

export const ACTIVE_JUDGE_WHERE = {
  role: { not: Role.REGISTRANT },
  staffPermissions: { has: StaffPermission.SCORE },
  isActive: true,
  verified: true,
} satisfies Prisma.UserWhereInput;

export const MANAGING_AGENCY_SUMMARY_SELECT = {
  id: true,
  code: true,
  name: true,
  order: true,
  isActive: true,
} satisfies Prisma.ManagingAgencySelect;

export const MANAGING_AGENCY_REF_SELECT = {
  id: true,
  code: true,
  name: true,
} satisfies Prisma.ManagingAgencySelect;

export const ORG_UNIT_SUMMARY_SELECT = {
  id: true,
  code: true,
  name: true,
  managingAgencyId: true,
  managingAgency: { select: MANAGING_AGENCY_REF_SELECT },
} satisfies Prisma.OrganizationUnitSelect;

export const ORG_UNIT_WITH_FULL_AGENCY_SELECT = {
  id: true,
  code: true,
  name: true,
  managingAgencyId: true,
  managingAgency: { select: MANAGING_AGENCY_SUMMARY_SELECT },
} satisfies Prisma.OrganizationUnitSelect;

export const USER_AUTH_PUBLIC_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  roles: true,
  verified: true,
  isActive: true,
  tokenVersion: true,
  staffPermissions: true,
  organizationUnitId: true,
  organizationUnit: { select: ORG_UNIT_SUMMARY_SELECT },
} satisfies Prisma.UserSelect;

export const REGISTRATION_UNIT_SELECT = {
  id: true,
  entityName: true,
  representativeName: true,
  representativeTitle: true,
  contactAddress: true,
  provinceName: true,
  localityName: true,
  localityCode: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RegistrationUnitSelect;
