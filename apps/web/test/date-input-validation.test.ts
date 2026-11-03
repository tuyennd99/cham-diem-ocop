import assert from 'node:assert/strict';
import { it } from 'node:test';
import { parseDateInputParts } from '../src/components/range-picker/date-input-validation.ts';

it('accepts real dates and rejects incomplete or impossible date input', () => {
  const leapDay = parseDateInputParts({ day: '29', month: '02', year: '2024' });
  assert.ok(leapDay);
  assert.equal(leapDay.getFullYear(), 2024);
  assert.equal(leapDay.getMonth(), 1);
  assert.equal(leapDay.getDate(), 29);

  for (const parts of [
    { day: '', month: '02', year: '2024' },
    { day: '29', month: '02', year: '2025' },
    { day: '31', month: '04', year: '2026' },
    { day: '1', month: '13', year: '2026' },
    { day: '0', month: '01', year: '2026' },
    { day: '1', month: '1', year: '202' },
    { day: '1a', month: '1', year: '2026' },
    { day: '1', month: '1', year: '0999' },
  ]) {
    assert.equal(parseDateInputParts(parts), undefined);
  }
});
