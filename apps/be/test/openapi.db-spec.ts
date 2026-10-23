import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';

describe('built API OpenAPI document', () => {
  it('describes DTOs, multipart upload, and declared bearer security', async () => {
    const { appControllers } =
      require('../dist/src/controllers') as typeof import('../dist/src/controllers');
    const { createOpenApiDocument } =
      require('../dist/src/config/app') as typeof import('../dist/src/config/app');
    const dependencies = new Map<
      Function,
      { provide: Function; useValue: object }
    >();
    for (const controller of appControllers) {
      for (const dependency of Reflect.getMetadata(
        'design:paramtypes',
        controller,
      ) ?? []) {
        if (typeof dependency === 'function')
          dependencies.set(dependency, { provide: dependency, useValue: {} });
      }
    }

    class OpenApiTestModule {}
    Module({
      controllers: appControllers,
      providers: [...dependencies.values()],
    })(OpenApiTestModule);

    const app = await NestFactory.create(OpenApiTestModule, { logger: false });
    try {
      app.setGlobalPrefix('api');
      const document = createOpenApiDocument(app) as OpenAPIObject;
      const schemas = document.components?.schemas ?? {};

      expect(document.components?.securitySchemes).toHaveProperty('bearer');
      expect(document.paths['/api/auth/me'].get?.security).toEqual([
        { bearer: [] },
      ]);
      expect(schemas.RegisterDto).toHaveProperty('properties.email');
      expect(schemas.RegisterDto).toHaveProperty('properties.password');
      expect(schemas.RegisterDto).toHaveProperty(
        'properties.phone.nullable',
        true,
      );
      expect(
        (schemas.RegisterDto as { required?: string[] }).required ?? [],
      ).not.toContain('phone');
      expect(schemas.CreateJudgeDto).toHaveProperty(
        'properties.password.maxLength',
        72,
      );
      expect(schemas.CreateJudgeDto).toHaveProperty(
        'properties.phone.nullable',
        true,
      );
      expect(schemas.CreateJudgeDto).toHaveProperty(
        'properties.organizationUnitId',
      );
      expect(schemas.CreateJudgeDto).toHaveProperty('properties.reason');
      expect(
        (schemas.CreateJudgeDto as { required?: string[] }).required ?? [],
      ).toEqual(expect.arrayContaining(['organizationUnitId', 'reason']));
      expect(schemas.UpdateJudgeDto).toHaveProperty('properties.reason');
      expect(schemas.ResetJudgePasswordDto).toHaveProperty('properties.reason');
      expect(schemas.DeactivateJudgeDto).toHaveProperty('properties.reason');

      const usersCreate = schemas.CreateAdminUserDto as {
        properties: Record<string, unknown>;
        required?: string[];
      };
      expect(usersCreate.properties).toHaveProperty('staffPermissions');
      expect(usersCreate.properties).toHaveProperty('organizationUnitId');
      expect(usersCreate.properties).toHaveProperty('reason');
      expect(usersCreate.properties).not.toHaveProperty('role');
      expect(usersCreate.required ?? []).toEqual(
        expect.arrayContaining([
          'email',
          'fullName',
          'password',
          'organizationUnitId',
          'staffPermissions',
          'reason',
        ]),
      );
      expect(schemas.AdminUsersQueryDto).toHaveProperty(
        'properties.permission.enum',
      );
      expect(schemas.AdminUsersQueryDto).toHaveProperty('properties.kind.enum');
      expect(schemas.UpdateAdminUserProfileDto).toHaveProperty(
        'properties.reason',
      );
      expect(schemas.UpdateAdminUserStatusDto).toHaveProperty(
        'properties.reason',
      );
      expect(schemas.ResetAdminUserPasswordDto).toHaveProperty(
        'properties.reason',
      );
      for (const path of [
        '/api/admin/users',
        '/api/admin/users/{id}',
        '/api/admin/users/{id}/status',
        '/api/admin/users/{id}/reset-password',
      ]) {
        expect(document.paths[path]).toBeDefined();
      }
      expect(schemas.ProductWriteDto).toHaveProperty(
        'properties.formData.$ref',
        '#/components/schemas/ProductApplicationDto',
      );
      expect(schemas.ProductWriteDto).toHaveProperty('properties.localityId');
      expect(schemas.ProductUpdateDto).toHaveProperty('properties.localityId');
      expect(schemas.AdminProductCreateDto).toHaveProperty(
        'properties.registrantId',
      );
      expect(schemas.AdminProductCreateDto).toHaveProperty('properties.reason');
      expect(schemas.AdminProductCreateDto).not.toHaveProperty('properties.actor');
      expect(schemas.AdminProductCreateDto).not.toHaveProperty('properties.canManage');
      expect(schemas.AdminProductCreateDto).not.toHaveProperty(
        'properties.registrationSnapshot',
      );
      expect(document.paths['/api/admin/products']?.post).toBeDefined();
      for (const path of [
        '/api/admin/products',
        '/api/admin/products/{id}',
        '/api/admin/products/{id}/results',
        '/api/admin/products/{id}/attachments',
        '/api/admin/products/{id}/attachments/{attachmentId}',
      ]) {
        expect(document.paths[path]).toBeDefined();
      }
      const productQueryParameters = document.paths['/api/admin/products'].get
        ?.parameters as { name?: string; in?: string }[];
      expect(
        productQueryParameters
          .filter((parameter) => parameter.in === 'query')
          .map((parameter) => parameter.name),
      ).toEqual(
        expect.arrayContaining([
          'page',
          'limit',
          'q',
          'groupId',
          'categoryId',
          'registrantId',
          'registrantQ',
          'localityId',
          'unmappedLocality',
          'status',
          'registrationType',
          'assessmentYear',
          'dateBasis',
          'from',
          'toExclusive',
          'starRating',
          'sortBy',
          'sortDirection',
        ]),
      );
      const adminUpload = document.paths[
        '/api/admin/products/{id}/attachments'
      ].post?.requestBody as {
        content: {
          'multipart/form-data': {
            schema: { properties: Record<string, unknown> };
          };
        };
      };
      expect(
        adminUpload.content['multipart/form-data'].schema.properties.file,
      ).toEqual({ type: 'string', format: 'binary' });
      expect(
        adminUpload.content['multipart/form-data'].schema.properties.reason,
      ).toEqual({ type: 'string', maxLength: 255 });
      expect(schemas.ProductApplicationDto).toHaveProperty(
        'properties.entityName',
      );
      expect(schemas.ProductApplicationDto).toHaveProperty(
        'properties.email.nullable',
        true,
      );
      expect(schemas.ProductApplicationDto).toHaveProperty(
        'properties.registrationType.nullable',
        true,
      );
      expect(schemas.ProductApplicationDto).toHaveProperty(
        'properties.sampleQuantity.nullable',
        true,
      );
      const productApplicationRequired =
        (schemas.ProductApplicationDto as { required?: string[] }).required ??
        [];
      for (const field of ['email', 'registrationType', 'sampleQuantity']) {
        expect(productApplicationRequired).not.toContain(field);
      }
      expect(schemas.EvaluationScoreDto).toHaveProperty(
        'properties.subCriterionId',
      );
      expect(schemas.SaveEvaluationDto).toHaveProperty(
        'properties.scores.items.$ref',
        '#/components/schemas/EvaluationScoreDto',
      );
      expect(schemas.AssignmentInputDto).toHaveProperty(
        'properties.criterionIds',
      );
      expect(schemas.ReplaceAssignmentsDto).toHaveProperty(
        'properties.assignments.items.$ref',
        '#/components/schemas/AssignmentInputDto',
      );

      const uploadSchema = document.paths['/api/my/products/{id}/attachments']
        .post?.requestBody as {
        content: {
          'multipart/form-data': {
            schema: { properties: Record<string, unknown> };
          };
        };
      };
      expect(
        uploadSchema.content['multipart/form-data'].schema.properties.file,
      ).toEqual({
        type: 'string',
        format: 'binary',
      });

      const schemes = document.components?.securitySchemes ?? {};
      for (const path of Object.values(document.paths)) {
        for (const operation of Object.values(path ?? {})) {
          if (
            !operation ||
            typeof operation !== 'object' ||
            !('security' in operation)
          )
            continue;
          for (const requirement of operation.security ?? []) {
            for (const scheme of Object.keys(requirement))
              expect(schemes).toHaveProperty(scheme);
          }
        }
      }
    } finally {
      await app.close();
    }
  });
});
