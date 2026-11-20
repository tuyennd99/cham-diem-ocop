import { Injectable, NotFoundException } from '@nestjs/common';
import { computePaginationSkip } from '../dtos/common.dto';
import { JudgeQueueQueryDto, SaveEvaluationDto } from '../dtos/evaluations.dto';
import { EvaluationsRepository } from '../repositories/evaluations.repository';
import { openStoredFile } from '../utils/private-storage';

@Injectable()
export class EvaluationsService {
  constructor(private readonly repository: EvaluationsRepository) {}

  async listQueue(judgeId: string, query?: JudgeQueueQueryDto) {
    const normalized = Object.assign(new JudgeQueueQueryDto(), query);
    computePaginationSkip(normalized.page, normalized.limit);
    const { data, total, counts } = await this.repository.listQueue(
      judgeId,
      normalized,
    );
    return {
      data,
      meta: {
        page: normalized.page,
        limit: normalized.limit,
        total,
        totalPages: Math.ceil(total / normalized.limit),
        counts,
      },
    };
  }

  getEvaluation(judgeId: string, productId: string) {
    return this.repository.getEvaluation(judgeId, productId);
  }

  getEvaluationPrintData(judgeId: string, productId: string) {
    return this.repository.getEvaluationPrintData(judgeId, productId);
  }

  saveDraft(judgeId: string, productId: string, input: SaveEvaluationDto) {
    return this.repository.saveDraft(
      judgeId,
      productId,
      input.scores,
      input.versionToken,
    );
  }

  submit(judgeId: string, productId: string, versionToken?: string) {
    return this.repository.submit(judgeId, productId, versionToken);
  }

  async attachment(judgeId: string, productId: string, attachmentId: string) {
    const file = await this.repository.findAttachment(
      judgeId,
      productId,
      attachmentId,
    );
    if (!file) throw new NotFoundException('Attachment not found');
    return openStoredFile(file.filePath, file.fileName);
  }
}
