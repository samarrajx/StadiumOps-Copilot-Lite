/**
 * @file cache.test.js
 * Tests for /functions/_lib/cache.js
 *
 * Covers: cache miss, hit, TTL expiry, boundary at TTL, makeCacheKey
 * determinism, order-independence of language codes, and the setCached/
 * getCached round-trip.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCacheKey, getCached, setCached } from '../functions/_lib/cache.js';

const TTL  = 5_000; // 5 seconds
const T0   = 1_000_000_000; // arbitrary base time

// ---------------------------------------------------------------------------
// getCached
// ---------------------------------------------------------------------------

test('cache: getCached returns null for a missing key (cold miss)', () => {
  const store = new Map();
  assert.equal(getCached(store, 'nonexistent', TTL, T0), null);
});

test('cache: getCached returns the stored value before TTL expires (cache hit)', () => {
  const store = new Map();
  setCached(store, 'k1', { result: 'hello' }, T0);
  // Access well before TTL
  const value = getCached(store, 'k1', TTL, T0 + 100);
  assert.deepEqual(value, { result: 'hello' });
});

test('cache: getCached returns null after TTL is exceeded (expiry)', () => {
  const store = new Map();
  setCached(store, 'k2', 'stale-value', T0);
  // Access after TTL
  const value = getCached(store, 'k2', TTL, T0 + TTL + 1);
  assert.equal(value, null);
});

test('cache: getCached returns fresh value at exactly TTL ms old (boundary — still valid)', () => {
  // TTL check uses > so at exactly TTL the entry is still fresh
  const store = new Map();
  setCached(store, 'k3', 'boundary-value', T0);
  const value = getCached(store, 'k3', TTL, T0 + TTL);
  assert.equal(value, 'boundary-value', 'entry at exactly TTL should still be considered fresh');
});

test('cache: getCached evicts expired entry from the store on access', () => {
  const store = new Map();
  setCached(store, 'k4', 'will-expire', T0);
  // Trigger expiry
  getCached(store, 'k4', TTL, T0 + TTL + 1);
  // Entry should have been deleted
  assert.equal(store.has('k4'), false, 'expired entry should be evicted from store');
});

// ---------------------------------------------------------------------------
// setCached / round-trip
// ---------------------------------------------------------------------------

test('cache: setCached + getCached round-trip preserves complex values', () => {
  const store = new Map();
  const payload = { translations: [{ lang: 'es', text: 'Hola' }], plainLanguage: 'Hello' };
  setCached(store, 'broadcast-1', payload, T0);
  const retrieved = getCached(store, 'broadcast-1', TTL, T0 + 1000);
  assert.deepEqual(retrieved, payload);
});

test('cache: setCached overwrites a previous value for the same key', () => {
  const store = new Map();
  setCached(store, 'k5', 'first', T0);
  setCached(store, 'k5', 'second', T0 + 100);
  const value = getCached(store, 'k5', TTL, T0 + 200);
  assert.equal(value, 'second', 'later setCached should overwrite earlier value');
});

// ---------------------------------------------------------------------------
// makeCacheKey
// ---------------------------------------------------------------------------

test('makeCacheKey: same inputs always produce the same key (determinism)', () => {
  const key1 = makeCacheKey('Gate A is now open.', ['es', 'fr']);
  const key2 = makeCacheKey('Gate A is now open.', ['es', 'fr']);
  assert.equal(key1, key2);
});

test('makeCacheKey: different language order produces the same key (sorting)', () => {
  const keyA = makeCacheKey('Please proceed to Gate B.', ['fr', 'es', 'de']);
  const keyB = makeCacheKey('Please proceed to Gate B.', ['de', 'fr', 'es']);
  const keyC = makeCacheKey('Please proceed to Gate B.', ['es', 'de', 'fr']);
  assert.equal(keyA, keyB, 'order of languages should not change the key');
  assert.equal(keyB, keyC, 'order of languages should not change the key');
});

test('makeCacheKey: different message produces a different key', () => {
  const key1 = makeCacheKey('Gate A open.',  ['en']);
  const key2 = makeCacheKey('Gate B closed.', ['en']);
  assert.notEqual(key1, key2, 'different messages must yield different keys');
});

test('makeCacheKey: different language sets produce different keys', () => {
  const key1 = makeCacheKey('Same message.', ['es']);
  const key2 = makeCacheKey('Same message.', ['fr']);
  assert.notEqual(key1, key2, 'different language sets must yield different keys');
});

test('makeCacheKey: returns a non-empty string for any valid input', () => {
  const key = makeCacheKey('Hello.', ['en', 'es']);
  assert.ok(typeof key === 'string' && key.length > 0, 'key must be a non-empty string');
});
