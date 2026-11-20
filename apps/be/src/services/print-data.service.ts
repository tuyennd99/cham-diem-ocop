import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminScoringRepository } from '../repositories/admin/admin-scoring.repository';

@Injectable()
export class PrintDataService {
  constructor(private readonly scoring: AdminScoringRepository) {}

  async myProductRegistrationPrintData(
    productId: string,
    registrantId: string,
  ) {
    const data = await this.scoring.findProductRegistrationPrintData(
      productId,
      { canManage: false, canView: false, registrantId },
    );
    if (!data) throw new NotFoundException('Product not found');
    return data;
  }

  async myProductResultsPrintData(productId: string, registrantId: string) {
    const data = await this.scoring.findProductResultsPrintData(productId, {
      canManage: false,
      canView: false,
      registrantId,
    });
    if (!data) throw new NotFoundException('Product not found');
    return data;
  }

  async getCriteriaSetPrintData(
    id: string,
    access: { canViewAll: boolean; scorerUserId?: string },
  ) {
    const data = await this.scoring.findCriteriaSetPrintData(id, access);
    if (!data) throw new NotFoundException('Criteria set not found');
    return data;
  }

  async getEvaluationPrintData(
    evaluationId: string,
    access: { canManage: boolean; canView: boolean; scorerUserId: string },
  ) {
    const data = await this.scoring.findEvaluationPrintData(
      evaluationId,
      access,
    );
    if (!data) throw new NotFoundException('Evaluation not found');
    return data;
  }

  async productRegistrationPrintData(
    productId: string,
    access: { canManage: boolean; canView: boolean },
  ) {
    const data = await this.scoring.findProductRegistrationPrintData(
      productId,
      access,
    );
    if (!data) throw new NotFoundException('Product not found');
    return data;
  }

  async productResultsPrintData(
    productId: string,
    access: { canManage: boolean; canView: boolean },
  ) {
    const data = await this.scoring.findProductResultsPrintData(
      productId,
      access,
    );
    if (!data) throw new NotFoundException('Product not found');
    return data;
  }
}
