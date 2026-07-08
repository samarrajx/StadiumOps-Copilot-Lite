/**
 * @file handler-gate-recommend.test.js
 * Tests for /functions/api/gate-recommend.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/api/gate-recommend.js';

function makeContext(body = {}, opts = {}) {
  const request = new Request('http://localhost/api/gate-recommend', {
    method: 'POST',
    headers: {
      'Content-Type':     'application/json',
      'origin':           opts.origin ?? 'http://localhost:8788',
      'cf-connecting-ip': opts.ip ?? '10.0.0.3',
    },
    body: JSON.stringify(body),
  });
  return { request, env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' } };
}

const fakeGemini = async () => 'Recommend Gate E (South-West). Wait time is 12 min, the lowest across all gates.';

// ---------------------------------------------------------------------------

test('gate-recommend: 200 success returns { recommendation: string }', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.recommendation, 'string');
  assert.ok(body.recommendation.length > 0);
});

test('gate-recommend: client-sent signals body is ignored (success even with garbage body)', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  // Send a body with intentionally wrong/missing signals — handler should not crash
  const req = new Request('http://localhost/api/gate-recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'origin': 'http://localhost:8788', 'cf-connecting-ip': '10.0.0.3' },
    body: JSON.stringify({ signals: { garbage: true, gates: null } }),
  });
  const res  = await handler({ request: req, env: { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' } });
  const body = await res.json();
  // Should still succeed because handler ignores client body and re-derives signals
  assert.equal(res.status, 200);
  assert.ok(typeof body.recommendation === 'string');
});

test('gate-recommend: 429 when rate limit exceeded', async () => {
  const store   = new Map();
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: store, _maxRequests: 1 });
  await handler(makeContext());
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 429);
  assert.ok(body.error.length > 0);
});

test('gate-recommend: 429 has Retry-After header', async () => {
  const store   = new Map();
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: store, _maxRequests: 1 });
  await handler(makeContext());
  const res = await handler(makeContext());
  assert.ok(res.headers.has('Retry-After'));
});

test('gate-recommend: CORS header matches request origin', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res = await handler(makeContext({}, { origin: 'https://stadiumops.example' }));
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://stadiumops.example');
});

test('gate-recommend: 503 when Gemini throws', async () => {
  const handler = createHandler({
    callGemini: async () => { throw new Error('timeout'); },
    _rateLimitStore: new Map(),
  });
  const res = await handler(makeContext());
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.ok(!JSON.stringify(body).includes('test-key'), 'API key must not appear in 503 body');
});
