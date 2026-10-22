import { JwtService } from '@nestjs/jwt';
import { Role, StaffPermission } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JWT_AUDIENCE, JWT_ISSUER } from '../src/constants/auth';
import { AdminRepository } from '../src/repositories/admin.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { apiRequest, withTestApp } from './support/db-app';

const password = 'StaffPassword1!';
async function staff(prisma: PrismaService, permissions: StaffPermission[], overrides: object = {}) {
  return prisma.user.create({ data: {
    email: `${randomUUID()}@example.invalid`, password: await bcrypt.hash(password, 4), fullName: 'Staff fixture', verified: true,
    role: permissions.includes('MANAGE') ? Role.ADMIN : permissions.includes('SCORE') ? Role.JUDGE : Role.VIEWER,
    staffPermissions: permissions, ...overrides,
  } });
}
function bearer(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }
function token(jwt: JwtService, user: { id: string; email: string; role: Role; tokenVersion: number }, extra = {}) {
  return jwt.signAsync({ sub: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion, ...extra }, {
    secret: process.env.JWT_SECRET, issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: 3600,
  });
}
const access = (staffPermissions: StaffPermission[], organizationUnitId: string | null = null, isActive = true) => ({
  staffPermissions, organizationUnitId, isActive, reason: 'Access review',
});

describe('H3 database permissions and staff access', () => {
  it('enforces USR-01..03 on reads, writes, current assignments and private files', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const jwt = app.get(JwtService);
      const [manager, viewer, scorer, combined, viewScore, registrant] = await Promise.all([
        staff(prisma, ['MANAGE', 'VIEW']), staff(prisma, ['VIEW']), staff(prisma, ['SCORE']),
        staff(prisma, ['MANAGE', 'VIEW', 'SCORE']), staff(prisma, ['VIEW', 'SCORE']),
        staff(prisma, [], { role: Role.REGISTRANT }),
      ]);
      const [category, otherCategory] = await prisma.productCategory.findMany({ take: 2, orderBy: { id: 'asc' } });
      const product = await prisma.product.create({ data: { registrantId: registrant.id, categoryId: category.id, name: 'Submitted', formData: {}, status: 'SUBMITTED' } });
      const outside = await prisma.product.create({ data: { registrantId: registrant.id, categoryId: otherCategory.id, name: 'Outside', formData: {}, status: 'SUBMITTED' } });
      const draft = await prisma.product.create({ data: { registrantId: registrant.id, categoryId: category.id, name: 'Private draft', formData: {} } });
      await prisma.judgeAssignment.createMany({ data: [scorer, combined, viewScore].map(({ id }) => ({ judgeId: id, categoryId: category.id, criterionIds: [] })) });
      const draftEvaluation = await prisma.evaluation.create({ data: { productId: product.id, judgeId: scorer.id } });
      const submitted = await prisma.evaluation.create({ data: { productId: product.id, judgeId: combined.id, status: 'SUBMITTED', total: 0 } });
      const fileKey = randomUUID();
      writeFileSync(join(process.env.STORAGE_PATH!, fileKey), 'staff evidence');
      const attachment = await prisma.attachment.create({ data: { productId: product.id, filePath: fileKey, fileName: 'Evidence.pdf', type: 'EVIDENCE' } });
      const [manageToken, viewToken, scoreToken, combinedToken, viewScoreToken, registrantToken] = await Promise.all(
        [manager, viewer, scorer, combined, viewScore, registrant].map((user) => token(jwt, user)),
      );
      const request = (auth: string, path: string, method = 'GET', body?: unknown) => apiRequest<any>(baseUrl, path, {
        method, headers: bearer(auth), ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      expect((await request(manageToken, '/admin/dashboard')).status).toBe(200);
      expect((await request(manageToken, `/judge/products/${product.id}/evaluation`, 'PUT', { scores: [] })).status).toBe(403);
      for (const auth of [viewToken, scoreToken]) {
        expect((await request(auth, '/admin/judges')).status).toBe(403);
        expect((await request(auth, '/admin/judges', 'POST', {})).status).toBe(403);
        expect((await request(auth, '/admin/assignments', 'PUT', { assignments: [] })).status).toBe(403);
        expect((await request(auth, `/admin/users/${scorer.id}/staff-access`, 'PUT', access(['VIEW']))).status).toBe(403);
      }
      expect((await request(viewToken, '/admin/dashboard')).status).toBe(200);
      expect((await request(viewToken, '/admin/assignments')).status).toBe(200);
      expect((await request(viewToken, `/judge/products/${product.id}/evaluation`, 'PUT', { scores: [] })).status).toBe(403);
      const listed = await request(viewToken, '/admin/products');
      expect(listed.status).toBe(200);
      expect(listed.body.data.map((item: any) => item.id)).not.toContain(draft.id);
      expect(listed.body.data.find((item: any) => item.id === product.id).evaluations).toEqual([{ judgeId: combined.id, status: 'SUBMITTED', total: 0 }]);
      expect((await request(viewToken, `/admin/products/${draft.id}/results`)).status).toBe(404);
      const results = await request(viewToken, `/admin/products/${product.id}/results`);
      expect(results.body.data.evaluations.map((item: any) => item.id)).toEqual([submitted.id]);
      const manageResults = await request(manageToken, `/admin/products/${product.id}/results`);
      expect(manageResults.body.data.evaluations.map((item: any) => item.id)).toContain(draftEvaluation.id);
      expect((await request(scoreToken, '/admin/dashboard')).status).toBe(403);
      expect((await request(scoreToken, `/judge/products/${outside.id}/evaluation`)).status).toBe(403);
      expect((await request(combinedToken, '/judge/products')).body.data.map((item: any) => item.id)).toEqual([product.id]);
      expect((await request(combinedToken, `/judge/products/${outside.id}/evaluation`)).status).toBe(403);
      expect((await request(viewScoreToken, '/admin/dashboard')).status).toBe(200);
      expect((await request(viewScoreToken, `/judge/products/${product.id}/evaluation`)).status).toBe(200);
      expect((await request(viewScoreToken, `/judge/products/${product.id}/evaluation`, 'PUT', { scores: [] })).status).toBe(200);
      expect((await request(registrantToken, '/my/products')).status).toBe(200);
      expect((await request(combinedToken, '/my/products')).status).toBe(403);
      const binaryPath = `/api/judge/products/${product.id}/attachments/${attachment.id}`;
      expect((await fetch(`${baseUrl}${binaryPath}`, { headers: bearer(scoreToken) })).status).toBe(200);
      expect((await fetch(`${baseUrl}${binaryPath}`, { headers: bearer(viewToken) })).status).toBe(403);
      await prisma.judgeAssignment.delete({ where: { judgeId_categoryId: { judgeId: scorer.id, categoryId: category.id } } });
      expect((await request(scoreToken, `/judge/products/${product.id}/evaluation`)).status).toBe(403);
      expect((await request(scoreToken, `/judge/products/${product.id}/evaluation`, 'PUT', { scores: [] })).status).toBe(403);
      expect((await fetch(`${baseUrl}${binaryPath}`, { headers: bearer(scoreToken) })).status).toBe(403);
      expect((await request(scoreToken, '/judge/products')).body.data).toEqual([]);
      const judges = await request(manageToken, '/admin/judges');
      expect(judges.body.data.map((item: any) => item.id)).toEqual(expect.arrayContaining([combined.id, scorer.id]));
      const dashboard = await request(manageToken, '/admin/dashboard');
      expect(dashboard.body.data.judges.map((item: any) => item.judgeId)).toContain(combined.id);
    });
  });

  it('hydrates login/me, validates access input, revokes tokens for permission/unit/status changes, and audits atomically', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const jwt = app.get(JwtService);
      const [manager, target, registrant] = await Promise.all([
        staff(prisma, ['MANAGE', 'VIEW']), staff(prisma, ['VIEW']), staff(prisma, [], { role: Role.REGISTRANT }),
      ]);
      const unit = await prisma.organizationUnit.create({ data: { code: 'TEST', name: 'Test unit' } });
      const inactiveUnit = await prisma.organizationUnit.create({ data: { code: 'OLD', name: 'Inactive', isActive: false } });
      const managerToken = await token(jwt, manager);
      const update = (id: string, body: unknown) => apiRequest<any>(baseUrl, `/admin/users/${id}/staff-access`, {
        method: 'PUT', headers: bearer(managerToken), body: JSON.stringify(body),
      });
      for (const invalid of [
        { ...access(['VIEW']), role: 'ADMIN' }, { ...access(['VIEW']), staffPermissions: ['UNKNOWN'] },
        access(['VIEW', 'VIEW']), access([]), access(['VIEW'], inactiveUnit.id), access(['VIEW'], 'missing'),
        { ...access(['VIEW']), reason: '   ' }, { ...access(['VIEW']), isActive: null },
        { staffPermissions: ['VIEW'], isActive: true, reason: 'Missing unit' },
      ]) expect((await update(target.id, invalid)).status).toBe(400);
      expect((await update(registrant.id, access(['MANAGE']))).status).toBe(404);
      let current = target;
      for (const changes of [access(['VIEW', 'SCORE']), access(['VIEW', 'SCORE'], unit.id), access(['VIEW', 'SCORE'], unit.id, false)]) {
        const oldToken = await token(jwt, current, { staffPermissions: ['MANAGE'] });
        const result = await update(target.id, changes);
        expect(result.status).toBe(200);
        const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
        expect(after.tokenVersion).toBe(current.tokenVersion + 1);
        expect((await apiRequest(baseUrl, '/auth/me', { headers: bearer(oldToken) })).status).toBe(401);
        expect((await prisma.auditLog.findMany({ where: { entityId: target.id }, orderBy: { createdAt: 'desc' } }))[0]).toMatchObject({
          actorId: manager.id, action: 'user.staff_access_update', reason: 'Access review',
          beforeData: { staffPermissions: current.staffPermissions, organizationUnitId: current.organizationUnitId, isActive: current.isActive },
          afterData: { staffPermissions: changes.staffPermissions, organizationUnitId: changes.organizationUnitId, isActive: changes.isActive },
        });
        current = after;
      }
      expect((await update(target.id, access(['MANAGE', 'SCORE'], unit.id))).status).toBe(200);
      const login = await apiRequest<any>(baseUrl, '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: target.email, password }) });
      expect(login.status).toBe(200);
      expect(login.body.data.user).toMatchObject({ role: 'ADMIN', staffPermissions: ['MANAGE', 'SCORE', 'VIEW'], organizationUnitId: unit.id, organizationUnit: { id: unit.id, code: unit.code, name: unit.name } });
      expect(login.body.data.user).not.toHaveProperty('password');
      expect(login.body.data.user).not.toHaveProperty('tokenVersion');
      const me = await apiRequest<any>(baseUrl, '/auth/me', { headers: bearer(login.body.data.accessToken) });
      expect(me.body.data).toEqual(login.body.data.user);
      const before = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      const auditCount = await prisma.auditLog.count();
      const repository = app.get(AdminRepository);
      const failure = jest.spyOn(repository as any, 'audit').mockRejectedValueOnce(new Error('Audit unavailable'));
      try {
        await expect(repository.updateStaffAccess(target.id, access(['VIEW'], null), manager.id, {})).rejects.toThrow('Audit unavailable');
      } finally { failure.mockRestore(); }
      expect(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).toEqual(before);
      expect(await prisma.auditLog.count()).toBe(auditCount);
    });
  });

  it('preserves the final active verified manager under simultaneous requests and through the legacy adapter', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const jwt = app.get(JwtService);
      const managers = await Promise.all([staff(prisma, ['MANAGE', 'VIEW', 'SCORE']), staff(prisma, ['MANAGE', 'VIEW', 'SCORE'])]);
      await staff(prisma, ['MANAGE'], { verified: false });
      await staff(prisma, ['MANAGE'], { isActive: false });
      const tokens = await Promise.all(managers.map((user) => token(jwt, user)));
      const results = await Promise.all(managers.map((user, index) => apiRequest(baseUrl, `/admin/users/${user.id}/staff-access`, {
        method: 'PUT', headers: bearer(tokens[index]), body: JSON.stringify(access(['VIEW'])),
      })));
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
      const remaining = await prisma.user.findMany({ where: { isActive: true, verified: true, staffPermissions: { has: 'MANAGE' } } });
      expect(remaining).toHaveLength(1);
      expect(await prisma.auditLog.count({ where: { action: 'user.staff_access_update' } })).toBe(1);
      const last = remaining[0];
      const lastToken = await token(jwt, last);
      expect((await apiRequest(baseUrl, `/admin/users/${last.id}/staff-access`, {
        method: 'PUT', headers: bearer(lastToken), body: JSON.stringify(access(['MANAGE', 'SCORE'], null, false)),
      })).status).toBe(409);
      expect((await apiRequest(baseUrl, `/admin/judges/${last.id}`, { method: 'DELETE', headers: bearer(lastToken) })).status).toBe(409);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: last.id } })).tokenVersion).toBe(0);
      expect(await prisma.auditLog.count({ where: { entityId: last.id } })).toBe(0);
    });
  });

  it('blocks withdrawing SCORE on open assignments, accepts combined managers as judges, and rejects unavailable scorers', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const [manager, scorer, unverified, inactive, registrant] = await Promise.all([
        staff(prisma, ['MANAGE', 'VIEW']), staff(prisma, ['MANAGE', 'VIEW', 'SCORE']),
        staff(prisma, ['SCORE'], { verified: false }), staff(prisma, ['SCORE'], { isActive: false }), staff(prisma, [], { role: Role.REGISTRANT }),
      ]);
      const category = await prisma.productCategory.findFirstOrThrow();
      const managerToken = await token(app.get(JwtService), manager);
      const replace = (judgeId: string) => apiRequest(baseUrl, '/admin/assignments', { method: 'PUT', headers: bearer(managerToken), body: JSON.stringify({ assignments: [{ judgeId, categoryId: category.id, criterionIds: [] }] }) });
      expect((await replace(scorer.id)).status).toBe(200);
      for (const user of [manager, unverified, inactive, registrant]) expect((await replace(user.id)).status).toBe(400);
      for (const user of [unverified, inactive]) {
        expect((await apiRequest(baseUrl, '/judge/products', { headers: bearer(await token(app.get(JwtService), user)) })).status).toBe(401);
      }
      const product = await prisma.product.create({ data: { registrantId: registrant.id, categoryId: category.id, name: 'Open', status: 'SUBMITTED', formData: {} } });
      const before = await prisma.user.findUniqueOrThrow({ where: { id: scorer.id } });
      for (const input of [access(['VIEW']), access(['MANAGE', 'SCORE'], null, false)]) {
        expect((await apiRequest(baseUrl, `/admin/users/${scorer.id}/staff-access`, { method: 'PUT', headers: bearer(managerToken), body: JSON.stringify(input) })).status).toBe(409);
      }
      expect(await prisma.user.findUniqueOrThrow({ where: { id: scorer.id } })).toEqual(before);
      expect(await prisma.auditLog.count({ where: { action: 'user.staff_access_update' } })).toBe(0);
      await prisma.product.update({ where: { id: product.id }, data: { status: 'COMPLETED' } });
      const oldToken = await token(app.get(JwtService), scorer);
      expect((await apiRequest(baseUrl, `/admin/judges/${scorer.id}`, { method: 'DELETE', headers: bearer(managerToken) })).status).toBe(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: scorer.id } })).tokenVersion).toBe(1);
      expect((await apiRequest(baseUrl, '/auth/me', { headers: bearer(oldToken) })).status).toBe(401);
    });
  });
});
