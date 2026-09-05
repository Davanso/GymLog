import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRepRange, parseRepRange } from '../../src/components/templateEditor/repRange.js';

test('repetition ranges accept supported formats and reject invalid limits', () => {
  assert.deepEqual(parseRepRange('10'), { min: 10, max: 10 });
  assert.deepEqual(parseRepRange('10-12'), { min: 10, max: 12 });
  assert.deepEqual(parseRepRange('de 10 a 12'), { min: 10, max: 12 });
  assert.equal(parseRepRange('12-10'), null);
  assert.equal(parseRepRange('0'), null);
  assert.equal(formatRepRange(10, 12), '10-12');
  assert.equal(formatRepRange(10, 10), '10');
});
