import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  clampColumnWidth,
  readStoredColumnWidths,
  writeStoredColumnWidths,
} from '../src/hooks/use-resizable-columns';

const BOUNDS = {
  left: { defaultWidth: 240, minWidth: 200, maxWidth: 380 },
  right: { defaultWidth: 280, minWidth: 240, maxWidth: 480 },
};

it('clamps column widths to minWidth, maxWidth, and dynamic availableMax', () => {
  assert.equal(clampColumnWidth(120, BOUNDS.left), 200);
  assert.equal(clampColumnWidth(500, BOUNDS.left), 380);
  assert.equal(clampColumnWidth(300.4, BOUNDS.left), 300);
  // Dynamic availableMax tighter than static maxWidth
  assert.equal(clampColumnWidth(360, BOUNDS.left, 290), 290);
  // Dynamic availableMax smaller than minWidth still respects minWidth floor
  assert.equal(clampColumnWidth(150, BOUNDS.left, 180), 200);
  // Non-finite input falls back safely to minWidth
  assert.equal(clampColumnWidth(Number.NaN, BOUNDS.right), 240);
});

it('reads, clamps, and writes versioned column widths in storage safely', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  // Empty storage returns defaults
  assert.deepEqual(readStoredColumnWidths('k', BOUNDS, mockStorage), { left: 240, right: 280 });

  // Round-trip valid widths
  writeStoredColumnWidths('k', { left: 310, right: 360 }, mockStorage);
  assert.deepEqual(readStoredColumnWidths('k', BOUNDS, mockStorage), { left: 310, right: 360 });

  // Out-of-range stored values get clamped
  store.set('k', JSON.stringify({ v: 1, left: 999, right: 50 }));
  assert.deepEqual(readStoredColumnWidths('k', BOUNDS, mockStorage), { left: 380, right: 240 });

  // Old/unknown schema version or invalid JSON falls back to defaults
  store.set('k', JSON.stringify({ v: 99, left: 300, right: 300 }));
  assert.deepEqual(readStoredColumnWidths('k', BOUNDS, mockStorage), { left: 240, right: 280 });

  store.set('k', '{corrupt-json');
  assert.deepEqual(readStoredColumnWidths('k', BOUNDS, mockStorage), { left: 240, right: 280 });
});
