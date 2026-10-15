import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { SaveEvaluationDto } from '../dtos/evaluations.dto';
import { EvaluationsRepository } from '../repositories/evaluations.repository';
import { storageRoot } from '../utils/private-storage';

@Injectable()
export class EvaluationsService {
  constructor(private readonly repository: EvaluationsRepository) {}

  listQueue(judgeId: string) {
    return this.repository.listQueue(judgeId);
  }

  getEvaluation(judgeId: string, productId: string) {
    return this.repository.getEvaluation(judgeId, productId);
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
    const root = storageRoot();
    const path = resolve(join(root, file.filePath));
    if (!/^[0-9a-f-]{36}$/i.test(file.filePath) || !path.startsWith(`${root}${sep}`)) {
      throw new ForbiddenException('Invalid storage key');
    }
    const extension = file.fileName.split('.').pop()?.toLowerCase();
    const mimeType: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', pdf: 'application/pdf',
    };
    const info = await stat(path);
    return {
      stream: createReadStream(path),
      originalName: file.fileName,
      mimeType: mimeType[extension ?? ''] ?? 'application/octet-stream',
      sizeBytes: info.size,
    };
  }
}
