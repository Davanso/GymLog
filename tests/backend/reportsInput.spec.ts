import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportPeriod } from '../../server/reports.js';

test('report input accepts supported periods', () => {
  assert.equal(reportPeriod('week'), 'week');
  assert.equal(reportPeriod('month'), 'month');
});

test('report input rejects unknown periods', () => {
  assert.throws(() => reportPeriod('year'));
  assert.throws(() => reportPeriod(null));
});
