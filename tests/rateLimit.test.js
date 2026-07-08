/**
 * @file rateLimit.test.js
 * Tests for /functions/_lib/rateLimit.js
 *
 * Covers: under-limit allowed, at-limit still allowed, over-limit blocked,
 * correct retryAfterMs, sliding window freeing capacity, per-key isolation,
 * and getClientKey header fallback chain.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, getClientKey } from '../functions/_lib/rateLimit.js';

// Constants for readability
const MAX  = 3;
const WIN  = 60_000; // 60 seconds
const T0   = 1_000_000; // arbitrary base time

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

test('rateLimit: first request is allowed (well under limit)', () => {
  const store = new Map();
  const result = checkRateLimit(store, 'ip-1', MAX, WIN, T0);
  assert.equal(result.allowed, true);
  assert.equal(result.retryAfterMs, 0);
});

test('rateLimit: requests up to maxRequests are all allowed', () => {
  const store = new Map();
  for (let i = 0; i < MAX; i++) {
    const result = checkRateLimit(store, 'ip-2', MAX, WIN, T0);
    assert.equal(result.allowed, true, `request ${i + 1} of ${MAX} should be allowed`);
  }
});

test('rateLimit: request exceeding maxRequests is blocked', () => {
  const store = new Map();
  // Exhaust the limit
  for (let i = 0; i < MAX; i++) {
    checkRateLimit(store, 'ip-3', MAX, WIN, T0);
  }
  // One more should be blocked
  const result = checkRateLimit(store, 'ip-3', MAX, WIN, T0);
  assert.equal(result.allowed, false);
});

test('rateLimit: blocked response has retryAfterMs > 0', () => {
  const store = new Map();
  for (let i = 0; i < MAX; i++) checkRateLimit(store, 'ip-4', MAX, WIN, T0);
  const result = checkRateLimit(store, 'ip-4', MAX, WIN, T0);
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs > 0, `retryAfterMs should be positive, got ${result.retryAfterMs}`);
});

test('rateLimit: retryAfterMs reflects time until oldest entry expires', () => {
  const store = new Map();
  const windowMs = 60_000;
  const t0 = 0;
  // 3 requests all at t0
  for (let i = 0; i < MAX; i++) checkRateLimit(store, 'ip-5', MAX, windowMs, t0);
  // 4th request 1000 ms later
  const laterMs = 1_000;
  const result = checkRateLimit(store, 'ip-5', MAX, windowMs, laterMs);
  assert.equal(result.allowed, false);
  // oldest = t0 = 0, expires at 0 + 60000 = 60000
  // retryAfterMs = 60000 - 1000 = 59000
  assert.equal(result.retryAfterMs, windowMs - laterMs);
});

test('rateLimit: sliding window releases capacity once old timestamps expire', () => {
  const store = new Map();
  const windowMs = 10_000;
  // Exhaust limit at t=0
  for (let i = 0; i < MAX; i++) checkRateLimit(store, 'ip-6', MAX, windowMs, 0);
  // Confirm blocked at t=0
  const blocked = checkRateLimit(store, 'ip-6', MAX, windowMs, 0);
  assert.equal(blocked.allowed, false);
  // At t = windowMs + 1 the old entries are pruned (0 is not > 1)
  const freed = checkRateLimit(store, 'ip-6', MAX, windowMs, windowMs + 1);
  assert.equal(freed.allowed, true, 'should be allowed after window has passed');
});

test('rateLimit: per-key isolation — key A exhausted does not block key B', () => {
  const store = new Map();
  // Exhaust key A
  for (let i = 0; i < MAX; i++) checkRateLimit(store, 'ip-A', MAX, WIN, T0);
  const aBlocked = checkRateLimit(store, 'ip-A', MAX, WIN, T0);
  assert.equal(aBlocked.allowed, false, 'ip-A should be blocked');
  // Key B is completely unaffected
  const bResult = checkRateLimit(store, 'ip-B', MAX, WIN, T0);
  assert.equal(bResult.allowed, true, 'ip-B should still be allowed');
});

test('rateLimit: rejected request is not recorded in the timestamp store', () => {
  const store = new Map();
  const windowMs = 10_000;
  // Exhaust limit at t=0
  for (let i = 0; i < MAX; i++) checkRateLimit(store, 'ip-7', MAX, windowMs, 0);
  // Block two more requests
  checkRateLimit(store, 'ip-7', MAX, windowMs, 0);
  checkRateLimit(store, 'ip-7', MAX, windowMs, 0);
  // The store should still only have MAX timestamps (rejected ones not added)
  assert.equal(store.get('ip-7').length, MAX);
});

// ---------------------------------------------------------------------------
// getClientKey
// ---------------------------------------------------------------------------

test('getClientKey: returns cf-connecting-ip when present', () => {
  const headers = { get: (name) => name === 'cf-connecting-ip' ? '1.2.3.4' : null };
  assert.equal(getClientKey(headers), '1.2.3.4');
});

test('getClientKey: falls back to x-forwarded-for when cf-connecting-ip absent', () => {
  const headers = {
    get: (name) => {
      if (name === 'cf-connecting-ip')  return null;
      if (name === 'x-forwarded-for')   return '5.6.7.8';
      return null;
    },
  };
  assert.equal(getClientKey(headers), '5.6.7.8');
});

test('getClientKey: falls back to "unknown" when both headers absent', () => {
  const headers = { get: () => null };
  assert.equal(getClientKey(headers), 'unknown');
});

test('getClientKey: returns "unknown" for null/undefined headersLike', () => {
  assert.equal(getClientKey(null),      'unknown');
  assert.equal(getClientKey(undefined), 'unknown');
});
