import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  localityEffectiveValue,
  vietnameseDateInput,
  vietnameseDateTimeInput,
  vietnameseDayRange,
} from '../src/lib/admin-date';

it('uses Vietnamese inclusive days across leap day and year boundary', () => {
  assert.deepEqual(vietnameseDayRange('2024-02-29', '2024-02-29'), {
    from: '2024-02-29T00:00:00+07:00',
    toExclusive: '2024-03-01T00:00:00+07:00',
  });
  assert.equal(
    vietnameseDayRange('2026-12-31', '2026-12-31').toExclusive,
    '2027-01-01T00:00:00+07:00',
  );
  assert.equal(vietnameseDateInput('2026-10-23T18:00:00Z'), '2026-10-24');
  assert.throws(() => vietnameseDayRange('2026-02-30', '2026-03-01'));
  assert.throws(() => vietnameseDayRange('2026-10-25', '2026-10-24'));
});

it('edits Vietnamese time without dropping milliseconds or changing untouched ISO', () => {
  const original = '2026-10-23T18:02:03.456Z';
  assert.equal(vietnameseDateTimeInput(original), '2026-10-24T01:02:03.456');
  assert.equal(localityEffectiveValue('2026-10-24T01:02:03.456', original), original);
  assert.equal(
    localityEffectiveValue('2026-10-25T01:02:03.456', original),
    '2026-10-25T01:02:03.456+07:00',
  );
  assert.equal(localityEffectiveValue('', original), null);
  assert.throws(() => localityEffectiveValue('2026-02-30T12:00'));
});
