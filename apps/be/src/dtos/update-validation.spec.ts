import {
  BadRequestException,
  Module,
  ValidationPipe,
  type Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  UpdateJudgeDto,
  ResetJudgePasswordDto,
  ReplaceAssignmentsDto,
  UpdateStaffAccessDto,
} from './admin.dto';
import { ProductUpdateDto } from './products.dto';
import { EvaluationScoreDto } from './evaluations.dto';
import { AdminController } from '../controllers/admin.controller';
import { MyProductsController } from '../controllers/my-products.controller';
import { AdminService } from '../services/admin.service';
import { ProductsService } from '../services/products.service';

const adminService = { updateJudge: jest.fn(), replaceAssignments: jest.fn() };
const productsService = { update: jest.fn() };

@Module({
  controllers: [AdminController, MyProductsController],
  providers: [
    { provide: AdminService, useValue: adminService },
    { provide: ProductsService, useValue: productsService },
  ],
})
class ValidationTestModule {}

describe('update DTO validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const validate = (body: object, metatype: Type<object>) =>
    pipe.transform(body, { type: 'body', metatype });

  it.each([
    [ProductUpdateDto, { name: null }],
    [ProductUpdateDto, { categoryId: null }],
    [ProductUpdateDto, { localityId: '' }],
    [ProductUpdateDto, { formData: null }],
    [UpdateJudgeDto, { fullName: null }],
    [UpdateJudgeDto, { reason: null }],
    [ResetJudgePasswordDto, { password: 'long-password-value', reason: null }],
    [ReplaceAssignmentsDto, { assignments: [], reason: null }],
    [
      UpdateStaffAccessDto,
      {
        staffPermissions: ['VIEW'],
        organizationUnitId: 'unit-1',
        isActive: null,
        reason: 'Access update',
      },
    ],
  ])('rejects null in non-nullable %p fields', async (metatype, body) => {
    await expect(validate(body, metatype)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    [ProductUpdateDto, {}],
    [UpdateJudgeDto, { reason: 'Profile update' }],
    [ResetJudgePasswordDto, { password: 'long-password-value', reason: 'Password reset' }],
    [ReplaceAssignmentsDto, { assignments: [] }],
    [
      UpdateStaffAccessDto,
      {
        staffPermissions: ['VIEW'],
        organizationUnitId: 'unit-1',
        reason: 'Access update',
      },
    ],
  ])('accepts omitted optional fields for %p', async (metatype, body) => {
    await expect(validate(body, metatype)).resolves.toBeDefined();
  });

  it('preserves explicit null for nullable update fields', async () => {
    await expect(
      validate({ description: null }, ProductUpdateDto),
    ).resolves.toMatchObject({ description: null });
    await expect(
      validate({ localityId: null }, ProductUpdateDto),
    ).resolves.toMatchObject({ localityId: null });
    await expect(
      validate({ phone: null, reason: 'Profile update' }, UpdateJudgeDto),
    ).resolves.toMatchObject({ phone: null });
    await expect(
      validate(
        { subCriterionId: 'criterion', optionId: 'option', note: null },
        EvaluationScoreDto,
      ),
    ).resolves.toMatchObject({ note: null });
  });

  it('rejects invalid PUT bodies before calling the write services', async () => {
    const app = await NestFactory.create(ValidationTestModule, {
      logger: false,
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');

    try {
      const baseUrl = await app.getUrl();
      for (const [path, body, service] of [
        ['/api/my/products/product-id', { name: null }, productsService.update],
        [
          '/api/admin/judges/judge-id',
          { fullName: null },
          adminService.updateJudge,
        ],
        [
          '/api/admin/judges/judge-id',
          { reason: null },
          adminService.updateJudge,
        ],
        [
          '/api/admin/assignments',
          { assignments: [], reason: null },
          adminService.replaceAssignments,
        ],
      ] as const) {
        jest.clearAllMocks();
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        expect(response.status).toBe(400);
        expect(service).not.toHaveBeenCalled();
      }
    } finally {
      await app.close();
    }
  });
});
