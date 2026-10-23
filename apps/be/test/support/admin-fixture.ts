import { JwtService } from '@nestjs/jwt';
import { Role, StaffPermission } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { JWT_ISSUER, JWT_AUDIENCE } from '../../src/constants/auth';
import { PrismaService } from '../../src/prisma/prisma.service';
import { apiRequest } from './db-app';

export async function adminFixture(
  app: INestApplication,
  prisma: PrismaService,
  baseUrl: string,
) {
  const unit = await prisma.organizationUnit.create({
    data: { code: 'TEST-U-' + randomUUID(), name: 'Test unit' },
  });
  const locality = await prisma.locality.create({
    data: {
      code: 'TEST-L-' + randomUUID(),
      name: 'Test locality',
      provinceName: 'Test province',
      type: 'COMMUNE',
    },
  });
  const password = await bcrypt.hash('StaffPassword1!', 4);
  const make = (role: Role, staffPermissions: StaffPermission[]) =>
    prisma.user.create({
      data: {
        email: randomUUID() + '@example.invalid',
        password,
        fullName: 'Test user',
        verified: true,
        isActive: true,
        role,
        staffPermissions,
        organizationUnitId: role === Role.REGISTRANT ? null : unit.id,
      },
    });
  const [manager, viewer, scorer, owner, otherOwner] = await Promise.all([
    make(Role.ADMIN, ['MANAGE', 'VIEW']),
    make(Role.VIEWER, ['VIEW']),
    make(Role.JUDGE, ['SCORE']),
    make(Role.REGISTRANT, []),
    make(Role.REGISTRANT, []),
  ]);
  const users = { manager, viewer, scorer, owner, otherOwner };
  const tokens = {} as Record<keyof typeof users, string>;
  for (const name of Object.keys(users) as (keyof typeof users)[]) {
    const u = users[name];
    tokens[name] = await app.get(JwtService).signAsync(
      {
        sub: u.id,
        email: u.email,
        role: u.role,
        tokenVersion: u.tokenVersion,
      },
      {
        secret: process.env.JWT_SECRET,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: 3600,
      },
    );
  }
  const headers = (as: keyof typeof users) => ({
    authorization: 'Bearer ' + tokens[as],
    'content-type': 'application/json',
  });
  const call = (
    as: keyof typeof users,
    path: string,
    method = 'GET',
    body?: unknown,
  ) =>
    apiRequest<any>(baseUrl, path, {
      method,
      headers: headers(as),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { ...users, unit, locality, call, headers };
}
export function draftPayload(categoryId: string, localityId?: string) {
  return {
    name: 'Test product',
    categoryId,
    localityId,
    formData: {
      entityName: 'Test entity',
      representativeName: 'Test representative',
      representativeTitle: 'Director',
      contactAddress: 'Test address',
      provinceName: 'Test province',
      email: 'contact@example.invalid',
      registrationType: 'FIRST',
      sampleQuantity: 1,
      assessmentYear: 2026,
      declarationAccepted: true,
    },
  };
}
