import assert from 'node:assert/strict'
import { matchesSchedulePeriod } from '../lib/admin/schedule-rules'

assert.equal(matchesSchedulePeriod('2026-10-14', '10', '2026'), true)
assert.equal(matchesSchedulePeriod('2026-09-14', '10', '2026'), false)
assert.equal(matchesSchedulePeriod('2025-10-14', '10', '2026'), false)
assert.equal(matchesSchedulePeriod('2026-01-14', '1', '2026'), true)
assert.equal(matchesSchedulePeriod('', '10', '2026'), false)
assert.equal(matchesSchedulePeriod('not-a-date', '10', '2026'), false)
console.log('PASS: schedule filters use both month and year')
