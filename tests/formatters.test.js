/**
 * @file formatters.test.js
 * Tests for /public/js/utils/formatters.js
 *
 * Covers: normal values, singular/plural, boundary values, null/undefined/NaN,
 * wrong types, and all formatRelativeTime time bands.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatWaitTime,
  formatSeverityLabel,
  formatRelativeTime,
} from '../public/js/utils/formatters.js';

const SEC = 1000;
const MIN = 60 * SEC;
const HR  = 60 * MIN;

// ============================================================================
// formatWaitTime
// ============================================================================

test('formatWaitTime: plural minutes', () => {
  assert.equal(formatWaitTime(3),  '3 min');
  assert.equal(formatWaitTime(15), '15 min');
  assert.equal(formatWaitTime(0),  '0 min');
});

test('formatWaitTime: singular at exactly 1', () => {
  assert.equal(formatWaitTime(1), '1 min');
});

test('formatWaitTime: rounds fractional minutes', () => {
  assert.equal(formatWaitTime(2.6), '3 min');
  assert.equal(formatWaitTime(1.4), '1 min');
});

test('formatWaitTime: returns "—" for null and undefined', () => {
  assert.equal(formatWaitTime(null),      '—');
  assert.equal(formatWaitTime(undefined), '—');
});

test('formatWaitTime: returns "—" for NaN, Infinity, and wrong types', () => {
  assert.equal(formatWaitTime(NaN),       '—');
  assert.equal(formatWaitTime(Infinity),  '—');
  assert.equal(formatWaitTime('5'),       '—');
  assert.equal(formatWaitTime({}),        '—');
});

// ============================================================================
// formatSeverityLabel
// ============================================================================

test('formatSeverityLabel: maps all three valid density values', () => {
  assert.equal(formatSeverityLabel('low'),    'Low');
  assert.equal(formatSeverityLabel('medium'), 'Moderate');
  assert.equal(formatSeverityLabel('high'),   'High');
});

test('formatSeverityLabel: returns "—" for unknown/null/undefined input', () => {
  assert.equal(formatSeverityLabel(null),      '—');
  assert.equal(formatSeverityLabel(undefined), '—');
  assert.equal(formatSeverityLabel(''),        '—');
  assert.equal(formatSeverityLabel('critical'),'—');
  assert.equal(formatSeverityLabel(42),        '—');
});

// ============================================================================
// formatRelativeTime
// ============================================================================

test('formatRelativeTime: "just now" for diff < 60 seconds', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(now - 5  * SEC, now), 'just now');
  assert.equal(formatRelativeTime(now - 59 * SEC, now), 'just now');
  assert.equal(formatRelativeTime(now,             now), 'just now'); // diff = 0
});

test('formatRelativeTime: minutes band "Xm ago"', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(now -  1 * MIN, now), '1m ago');
  assert.equal(formatRelativeTime(now - 30 * MIN, now), '30m ago');
  assert.equal(formatRelativeTime(now - 59 * MIN, now), '59m ago');
});

test('formatRelativeTime: hours band "Xh ago"', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(now -  1 * HR, now), '1h ago');
  assert.equal(formatRelativeTime(now -  3 * HR, now), '3h ago');
  assert.equal(formatRelativeTime(now - 24 * HR, now), '24h ago');
});

test('formatRelativeTime: returns "—" for null/undefined inputs', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(null,  now), '—');
  assert.equal(formatRelativeTime(now,  null), '—');
  assert.equal(formatRelativeTime(null, null), '—');
  assert.equal(formatRelativeTime(undefined, now), '—');
});

test('formatRelativeTime: returns "—" for NaN and non-number inputs', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(NaN,    now),  '—');
  assert.equal(formatRelativeTime('old',  now),  '—');
  assert.equal(formatRelativeTime(now,    'now'), '—');
  assert.equal(formatRelativeTime(now,    NaN),   '—');
});

test('formatRelativeTime: future timestamps clamped to "just now"', () => {
  const now = 1_700_000_000_000;
  // timestampMs in the future → negative diff → graceful "just now"
  assert.equal(formatRelativeTime(now + 60 * SEC, now), 'just now');
});
