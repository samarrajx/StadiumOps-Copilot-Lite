/**
 * @file handler-briefing.test.js
 * Tests for /functions/api/briefing.js
 * Uses createHandler({ callGemini, _rateLimitStore, _maxRequests }) for DI.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/api/briefing.js';

function makeContext(opts = {}) {
  const request = new Request('http://localhost/api/briefing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'origin':         opts.origin ?? 'http://localhost:8788',
      'cf-connecting-ip': opts.ip ?? '10.0.0.1',
    },
    body: '{}',
  });
  return { request, env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' } };
}

const FAKE_BRIEFING = 'Gate D is the busiest with 25 min wait. Rail is disrupted. No weather risk.';
const fakeGemini    = async () => FAKE_BRIEFING;

// ---------------------------------------------------------------------------

test('briefing: 200 success returns { briefing: string }', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.briefing, 'string');
  assert.ok(body.briefing.length > 0);
});

test('briefing: response includes Access-Control-Allow-Origin matching request origin', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res = await handler(makeContext({ origin: 'http://localhost:8788' }));
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8788');
});

test('briefing: CORS header is never "*"', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res = await handler(makeContext());
  assert.notEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
});

test('briefing: 429 when rate limit exceeded', async () => {
  const store   = new Map();
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: store, _maxRequests: 1 });
  await handler(makeContext());                 // 1st → allowed (exhausts limit of 1)
  const res  = await handler(makeContext());   // 2nd → blocked
  const body = await res.json();
  assert.equal(res.status, 429);
  assert.ok(body.error.toLowerCase().includes('slow down') || body.error.toLowerCase().includes('too many'));
});

test('briefing: 429 response includes Retry-After header', async () => {
  const store   = new Map();
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: store, _maxRequests: 1 });
  await handler(makeContext());
  const res = await handler(makeContext());
  assert.ok(res.headers.has('Retry-After'), 'Retry-After header must be present on 429');
});

test('briefing: 503 when Gemini throws; API key not in response body', async () => {
  const throwingGemini = async () => { throw new Error('Network failure'); };
  const handler = createHandler({ callGemini: throwingGemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.ok(body.error.length > 0);
  assert.ok(!JSON.stringify(body).includes('test-key'), 'API key must not appear in error response');
});
