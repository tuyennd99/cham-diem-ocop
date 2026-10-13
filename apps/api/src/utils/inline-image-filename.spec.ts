import { inlineImageFilename } from './private-storage';

describe('inlineImageFilename', () => {
  const suffix = /-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i;

  it('keeps a sanitized base name and appends -<uuidv7> + ext', () => {
    const name = inlineImageFilename('My Report Ảnh!.PNG');
    expect(name.toLowerCase().endsWith('.png')).toBe(true);
    expect(name).toMatch(/^My-Report-Anh-/); // spaces/diacritics/punct collapse; Ả→A
    expect(name).toMatch(suffix);
  });

  it('strips path separators so no traversal survives', () => {
    const name = inlineImageFilename('../../etc/passwd.png');
    expect(name.includes('/')).toBe(false);
    expect(name.includes('\\')).toBe(false);
    expect(name.includes('..')).toBe(false);
  });

  it('falls back to "image" when the base sanitizes to empty', () => {
    expect(inlineImageFilename('___.gif')).toMatch(/^image-.*\.gif$/);
    expect(inlineImageFilename('!!!.png')).toMatch(/^image-/);
  });

  it('generates a unique name each call', () => {
    expect(inlineImageFilename('a.png')).not.toBe(inlineImageFilename('a.png'));
  });
});
