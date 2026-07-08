/**
 * @file handler-assistant.test.js
 * Tests for /functions/api/assistant.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/api/assistant.js';

function makeContext(body = {}, opts = {}) {
  const request = new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: {
      'Content-Type':     'application/json',
      'origin':           opts.origin ?? 'http://localhost:8788',
      'cf-connecting-ip': opts.ip ?? '10.0.0.2',
    },
    body: JSON.stringify(body),
  });
  return { request, env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' } };
}

const fakeGemini = async () => 'Redirect fans to Gate E — it has the shortest wait.';

// ---------------------------------------------------------------------------

test('assistant: 200 success returns { answer: string }', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext({ question: 'Which gate is least busy?' }));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.answer, 'string');
  assert.ok(body.answer.length > 0);
});

test('assistant: 400 when question is missing', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext({}));
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.ok(typeof body.error === 'string' && body.error.length > 0);
});

test('assistant: 400 when question is empty string', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext({ question: '' }));
  assert.equal(res.status, 400);
});

test('assistant: 400 when question exceeds 500 characters', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext({ question: 'x'.repeat(501) }));
  assert.equal(res.status, 400);
});

test('assistant: 400 when history contains invalid role', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext({
    question: 'Valid question?',
    history:  [{ role: 'admin', content: 'hello' }],
  }));
  assert.equal(res.status, 400);
});

test('assistant: 429 when rate limit exceeded', async () => {
  const store   = new Map();
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: store, _maxRequests: 1 });
  await handler(makeContext({ question: 'First question.' }));
  const res  = await handler(makeContext({ question: 'Second question.' }));
  const body = await res.json();
  assert.equal(res.status, 429);
  assert.ok(body.error.toLowerCase().includes('slow down') || body.error.toLowerCase().includes('too many'));
});

test('assistant: 503 when Gemini throws', async () => {
  const handler = createHandler({
    callGemini: async () => { throw new Error('timeout'); },
    _rateLimitStore: new Map(),
  });
  const res = await handler(makeContext({ question: 'Is gate A open?' }));
  assert.equal(res.status, 503);
});

test('assistant: CORS header matches request origin', async () => {
  const handler = createHandler({ callGemini: fakeGemini, _rateLimitStore: new Map() });
  const res = await handler(makeContext({ question: 'Status?' }, { origin: 'https://example.com' }));
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
});
