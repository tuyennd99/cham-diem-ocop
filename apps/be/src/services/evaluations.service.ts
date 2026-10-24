import { Injectable, NotFoundException } from '@nestjs/common';
import { SaveEvaluationDto } from '../dtos/evaluations.dto';
import { EvaluationsRepository } from '../repositories/evaluations.repository';
import { openStoredFile } from '../utils/private-storage';

@Injectable()
export class EvaluationsService {
  constructor(private readonly repository: EvaluationsRepository) {}

  listQueue(judgeId: string) {
    return this.repository.listQueue(judgeId);
  }

  getEvaluation(judgeId: string, productId: string) {
    return this.repository.getEvaluation(judgeId, productId);
  }

  getEvaluationPrintData(judgeId: string, productId: string) {
    return this.repository.getEvaluationPrintData(judgeId, productId);
  }

  saveDraft(judgeId: string, productId: string, input: SaveEvaluationDto) {
    return this.repository.saveDraft(judgeId, productId, input.scores);
  }

  submit(judgeId: string, productId: string) {
    return this.repository.submit(judgeId, productId);
  }

  async attachment(judgeId: string, productId: string, attachmentId: string) {
    const file = await this.repository.findAttachment(judgeId, productId, attachmentId);
    if (!file) throw new NotFoundException('Attachment not found');
    return openStoredFile(file.filePath, file.fileName);
  }
}
