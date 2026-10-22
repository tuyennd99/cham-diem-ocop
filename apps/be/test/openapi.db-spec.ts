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
      expect(schemas.ProductWriteDto).toHaveProperty(
        'properties.formData.$ref',
        '#/components/schemas/ProductApplicationDto',
      );
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
