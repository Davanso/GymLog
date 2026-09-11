import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarDate, calendarMonth, calendarWeekdays } from '../../server/calendar.js';

test('calendar input accepts valid months, dates and unique ISO weekdays', () => {
  assert.equal(calendarMonth('2026-09'), '2026-09');
  assert.equal(calendarDate('2026-09-08'), '2026-09-08');
  assert.deepEqual(calendarWeekdays([5, 1, 5, 3]), [1, 3, 5]);
  assert.deepEqual(calendarWeekdays([]), []);
});

test('calendar input rejects malformed periods and weekdays', () => {
  assert.throws(() => calendarMonth('2026-13'));
  assert.throws(() => calendarDate('08/09/2026'));
  assert.throws(() => calendarDate('2026-02-30'));
  assert.throws(() => calendarWeekdays('segunda'));
  assert.throws(() => calendarWeekdays([0, 8]));
});
