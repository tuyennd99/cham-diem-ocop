import { UnsupportedMediaTypeException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { assertAllowedImage, sniffImageType } from './image-files';

describe('image-files', () => {
  it('sniffs real image magic bytes and rejects non-images', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const webp = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP', 'ascii'),
    ]);

    expect(sniffImageType(png)).toBe('png');
    expect(sniffImageType(jpeg)).toBe('jpeg');
    expect(sniffImageType(gif)).toBe('gif');
    expect(sniffImageType(webp)).toBe('webp');
    // PDF header (%PDF) must not pass as an image.
    expect(sniffImageType(Buffer.from('%PDF-1.7', 'ascii'))).toBeNull();
    expect(sniffImageType(Buffer.from([0x00, 0x01]))).toBeNull();
  });

  it('accepts allowed image extensions and rejects the rest by name', () => {
    expect(assertAllowedImage('photo.png')).toBe('png');
    expect(assertAllowedImage('photo.JPG')).toBe('jpg');
    expect(() => assertAllowedImage('note.pdf')).toThrow(
      UnsupportedMediaTypeException,
    );
    expect(() => assertAllowedImage('../evil.png')).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('generates uuid v7 filenames the stored-upload regex still accepts', () => {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (let i = 0; i < 100; i++) {
      const id = uuidv7();
      expect(id[14]).toBe('7'); // version nibble
      expect(uuidPattern.test(id)).toBe(true);
    }
  });
});
