import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { computePaginationSkip } from '../dtos/common.dto';
import { JudgeQueueQueryDto, SaveEvaluationDto } from '../dtos/evaluations.dto';
import { EvaluationsRepository } from '../repositories/evaluations.repository';
import { openStoredFile } from '../utils/private-storage';
import {
  CACHE_PREFIXES,
  invalidatePublicCachePrefixes,
} from '../utils/public-cache';
import { RedisService } from './redis.service';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly repository: EvaluationsRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

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

  async saveDraft(
    judgeId: string,
    productId: string,
    input: SaveEvaluationDto,
  ) {
    const saved = await this.repository.saveDraft(
      judgeId,
      productId,
      input.scores,
      input.versionToken,
    );
    await invalidatePublicCachePrefixes(
      this.redis,
      CACHE_PREFIXES.PUBLIC_PRODUCTS,
    );
    return saved;
  }

  async submit(judgeId: string, productId: string, versionToken?: string) {
    const submitted = await this.repository.submit(
      judgeId,
      productId,
      versionToken,
    );
    await invalidatePublicCachePrefixes(
      this.redis,
      CACHE_PREFIXES.PUBLIC_PRODUCTS,
    );
    return submitted;
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
