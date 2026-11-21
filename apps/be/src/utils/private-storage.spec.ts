import { HttpException, HttpStatus } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { asDownload, openStoredFile, parseByteRange } from './private-storage';

async function readStreamText(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('private-storage byte range support', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ocop-range-spec-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses bounded, open-ended, suffix, and unsatisfiable byte ranges', () => {
    expect(parseByteRange(undefined, 100)).toBeNull();
    expect(parseByteRange('items=0-10', 100)).toBeNull();
    expect(parseByteRange('bytes=0-5,10-15', 100)).toBeNull();
    expect(parseByteRange('bytes=0-9', 100)).toEqual({
      unsat: false,
      start: 0,
      end: 9,
    });
    expect(parseByteRange('bytes=90-500', 100)).toEqual({
      unsat: false,
      start: 90,
      end: 99,
    });
    expect(parseByteRange('bytes=95-', 100)).toEqual({
      unsat: false,
      start: 95,
      end: 99,
    });
    expect(parseByteRange('bytes=-10', 100)).toEqual({
      unsat: false,
      start: 90,
      end: 99,
    });
    expect(parseByteRange('bytes=100-120', 100)).toEqual({ unsat: true });
    expect(parseByteRange('bytes=20-10', 100)).toEqual({ unsat: true });
    expect(parseByteRange('bytes=0-', 0)).toEqual({ unsat: true });
  });

  it('streams requested slice with 206 Partial Content headers and rejects 416', async () => {
    const key = uuidv7();
    const content = Buffer.from('0123456789ABCDEF');
    writeFileSync(join(tempDir, key), content);

    const file = await openStoredFile(key, 'clip.mp4', tempDir, 'bytes=4-9');
    expect(file.range).toEqual({ start: 4, end: 9 });
    expect(file.mimeType).toBe('video/mp4');
    await expect(readStreamText(file.stream)).resolves.toBe('456789');

    const headers: Record<string, string> = {};
    let statusCode = 200;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name] = String(value);
        return this;
      },
    };
    const streamable = asDownload(file, 'inline', res);
    expect(statusCode).toBe(HttpStatus.PARTIAL_CONTENT);
    expect(headers['Accept-Ranges']).toBe('bytes');
    expect(headers['Content-Range']).toBe('bytes 4-9/16');
    expect(streamable.getHeaders().length).toBe(6);

    await expect(
      openStoredFile(key, 'clip.mp4', tempDir, 'bytes=100-200'),
    ).rejects.toThrow(HttpException);

    try {
      await openStoredFile(key, 'clip.mp4', tempDir, 'bytes=100-200');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
    }
  });
});
