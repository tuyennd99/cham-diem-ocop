import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename, extname } from 'node:path';
import type { DocumentType } from '../types/files';
import { MAX_DRAFT_BYTES } from './private-storage';

const documentMimes: Record<Exclude<DocumentType, 'unknown'>, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function assertDraftSize(sizeBytes: number) {
  if (sizeBytes > MAX_DRAFT_BYTES) {
    throw new PayloadTooLargeException('Draft attachments exceed 200MB');
  }
}

export function assertAllowedDocument(
  originalName: string,
  declaredMime: string,
  detectedType: DocumentType,
) {
  if (
    !originalName ||
    originalName !== basename(originalName) ||
    /[\0\r\n]/.test(originalName)
  ) {
    throw new UnsupportedMediaTypeException('Invalid file name');
  }
  const extension = extname(originalName).slice(1).toLowerCase();
  // Nội dung đã xác thực bằng magic-byte (detectedType) và extension phải khớp
  // detectedType — đó là hai lớp thật. declaredMime do trình duyệt gửi, .doc/.xls
  // trên một số OS gửi rỗng/generic → chỉ bắt khớp khi trình duyệt gửi MIME cụ thể.
  const genericMimes = new Set(['', 'application/octet-stream', 'application/x-msdownload']);
  if (
    detectedType === 'unknown' ||
    extension !== detectedType ||
    (!genericMimes.has(declaredMime) && documentMimes[detectedType] !== declaredMime)
  ) {
    throw new UnsupportedMediaTypeException(
      'File extension, MIME, and content must match',
    );
  }
}

export function documentMime(type: Exclude<DocumentType, 'unknown'>) {
  return documentMimes[type];
}

export async function inspectDocument(path: string) {
  const checksum = createHash('sha256');
  const pdf = Buffer.from('%PDF-');
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const word = Buffer.from('word/');
  const excel = Buffer.from('xl/');
  const wordDocument = Buffer.from('WordDocument', 'utf16le');
  const workbook = Buffer.from('Workbook', 'utf16le');
  const book = Buffer.from('Book', 'utf16le');
  let first = Buffer.alloc(0);
  let carry = Buffer.alloc(0);
  let sizeBytes = 0;
  let hasWord = false;
  let hasExcel = false;
  let hasWordDocument = false;
  let hasWorkbook = false;

  for await (const value of createReadStream(path)) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    checksum.update(chunk);
    sizeBytes += chunk.length;
    if (first.length < 8) {
      first = Buffer.concat([first, chunk]).subarray(0, 8);
    }
    const probe = Buffer.concat([carry, chunk]);
    hasWord ||= probe.includes(word);
    hasExcel ||= probe.includes(excel);
    hasWordDocument ||= probe.includes(wordDocument);
    hasWorkbook ||= probe.includes(workbook) || probe.includes(book);
    carry = probe.subarray(Math.max(0, probe.length - 64));
  }

  let type: DocumentType = 'unknown';
  if (first.subarray(0, pdf.length).equals(pdf)) type = 'pdf';
  else if (first.subarray(0, zip.length).equals(zip)) {
    if (hasWord) type = 'docx';
    else if (hasExcel) type = 'xlsx';
  } else if (first.equals(ole)) {
    if (hasWordDocument) type = 'doc';
    else if (hasWorkbook) type = 'xls';
  }
  return { type, sizeBytes, checksum: checksum.digest('hex') };
}
