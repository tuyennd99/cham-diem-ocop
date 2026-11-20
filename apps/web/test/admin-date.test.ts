import assert from 'node:assert/strict';
import { it } from 'node:test';
import { DATE_FORMAT, DATE_TIME_FORMAT } from '../src/constants/consts';
import {
  formatDate,
  formatDateTime,
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

it('formats dates and timestamps using DATE_FORMAT (dd/MM/yyyy) and DATE_TIME_FORMAT in Asia/Ho_Chi_Minh', () => {
  assert.equal(DATE_FORMAT, 'dd/MM/yyyy');
  assert.equal(DATE_TIME_FORMAT, 'dd/MM/yyyy HH:mm:ss');
  assert.equal(formatDate('2026-11-04'), '04/11/2026');
  assert.equal(formatDate('2026-11-04T02:30:00.000Z'), '04/11/2026');
  assert.equal(formatDate('2026-10-01T18:30:00.000Z'), '02/10/2026');
  assert.equal(formatDateTime('2026-11-04T02:03:04.000Z'), '04/11/2026 09:03:04');
  assert.equal(formatDate('2026-02-30'), '');
  assert.equal(formatDate(null), '');
});
