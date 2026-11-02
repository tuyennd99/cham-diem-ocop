import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';

const sourceRoot = new URL('../src/', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = specifier.startsWith('@/')
      ? new URL(specifier.slice(2), sourceRoot).href
      : specifier;
    try {
      return nextResolve(mapped, context);
    } catch (error) {
      if (!['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'].includes(error.code)) throw error;
      if (!(mapped.startsWith('.') || mapped.startsWith('file:')) || extname(mapped)) throw error;
      for (const suffix of ['.ts', '/index.ts']) {
        const candidate = new URL(mapped + suffix, context.parentURL);
        if (existsSync(candidate)) return nextResolve(candidate.href, context);
      }
      throw error;
    }
  },
});
