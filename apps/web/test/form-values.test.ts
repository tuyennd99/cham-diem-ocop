import assert from 'node:assert/strict';
import { it } from 'node:test';
import { numberInputValue } from '../src/components/form/field-values.ts';

it('keeps numbers numeric after clearing and typing again', () => {
  let value: number | undefined = 12;
  value = numberInputValue('', NaN);
  assert.equal(value, undefined);
  value = numberInputValue('23', 23);
  assert.equal(value, 23);
  assert.equal(typeof value, 'number');
  assert.equal(numberInputValue('0', 0), 0);
  assert.equal(numberInputValue('-1.5', -1.5), -1.5);
  assert.equal(numberInputValue('1e', NaN), undefined);
  assert.equal(numberInputValue('1e999', Infinity), undefined);
});
