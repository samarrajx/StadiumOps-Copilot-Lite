/**
 * @file state.test.js
 * Tests for /public/js/state.js
 *
 * Covers: initial state shape, setState merging, subscriber notification,
 * unsubscribe, multiple subscribers, and mutation isolation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../public/js/state.js';

// ---------------------------------------------------------------------------

test('state: getState() returns the initial state values', () => {
  const store = createStore({ phase: 'loading', count: 0 });
  const s = store.getState();
  assert.equal(s.phase, 'loading');
  assert.equal(s.count, 0);
});

test('state: setState() merges partial update — existing fields preserved', () => {
  const store = createStore({ phase: 'loading', count: 0, extra: 'keep' });
  store.setState({ phase: 'ready' });
  const s = store.getState();
  assert.equal(s.phase, 'ready');
  assert.equal(s.count, 0,     'count must be preserved after partial update');
  assert.equal(s.extra, 'keep','extra must be preserved after partial update');
});

test('state: setState() can add new keys not in initialState', () => {
  const store = createStore({ a: 1 });
  store.setState({ b: 2 });
  const s = store.getState();
  assert.equal(s.a, 1);
  assert.equal(s.b, 2);
});

test('state: subscriber is called with new state after setState()', () => {
  const store = createStore({ value: 'before' });
  let received = null;
  store.subscribe((state) => { received = state; });
  store.setState({ value: 'after' });
  assert.ok(received !== null, 'subscriber must have been called');
  assert.equal(received.value, 'after');
});

test('state: unsubscribe() stops the listener from receiving future updates', () => {
  const store = createStore({ n: 0 });
  let callCount = 0;
  const unsub = store.subscribe(() => { callCount++; });

  store.setState({ n: 1 }); // should call listener → callCount = 1
  unsub();
  store.setState({ n: 2 }); // listener should NOT be called again
  store.setState({ n: 3 });

  assert.equal(callCount, 1, 'listener must not be called after unsubscribe');
});

test('state: multiple subscribers are all notified on setState()', () => {
  const store = createStore({ x: 0 });
  const seen = [];
  store.subscribe((s) => seen.push(`A:${s.x}`));
  store.subscribe((s) => seen.push(`B:${s.x}`));
  store.setState({ x: 99 });
  assert.ok(seen.includes('A:99'), 'subscriber A must be notified');
  assert.ok(seen.includes('B:99'), 'subscriber B must be notified');
});

test('state: getState() returns a copy — mutating it does not affect the store', () => {
  const store = createStore({ items: ['a', 'b'] });
  const snapshot = store.getState();
  snapshot.newField = 'should-not-persist'; // mutate the returned copy
  snapshot.items.push('c');                 // mutate a nested value too (shallow limit)

  // The store's own string field must not have been affected
  const next = store.getState();
  assert.equal(next.newField, undefined, 'added field must not appear in store');
});
