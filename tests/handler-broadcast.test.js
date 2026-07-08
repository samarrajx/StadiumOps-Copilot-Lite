/**
 * @file handler-broadcast.test.js
 * Tests for /functions/api/broadcast.js
 * Includes cache-hit and cache-skip paths, shape validation, and 502 cases.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/api/broadcast.js';

const VALID_BODY = { message: 'Gate A is now open for boarding.', languages: ['es', 'fr'] };

const GOOD_AI_RESPONSE = JSON.stringify({
  translations: [
    { lang: 'es', text: 'La puerta A ya está abierta para embarcar.' },
    { lang: 'fr', text: 'La porte A est maintenant ouverte pour l\'embarquement.' },
  ],
  plainLanguage: 'Gate A is open. You can board now.',
});

function makeContext(body = VALID_BODY, opts = {}) {
  const request = new Request('http://localhost/api/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type':     'application/json',
      'origin':           opts.origin ?? 'http://localhost:8788',
      'cf-connecting-ip': opts.ip ?? '10.0.0.4',
    },
    body: JSON.stringify(body),
  });
  return { request, env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' } };
}

// ---------------------------------------------------------------------------

test('broadcast: 200 success returns translations + plainLanguage + cached:false', async () => {
  const handler = createHandler({
    callGemini: async () => GOOD_AI_RESPONSE,
    _rateLimitStore: new Map(),
    _cacheStore:    new Map(),
  });
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.translations));
  assert.equal(typeof body.plainLanguage, 'string');
  assert.equal(body.cached, false);
});

test('broadcast: second identical request returns cached:true without calling Gemini', async () => {
  const store = new Map();
  let callCount = 0;
  const countingGemini = async () => { callCount++; return GOOD_AI_RESPONSE; };
  const handler = createHandler({ callGemini: countingGemini, _rateLimitStore: new Map(), _cacheStore: store });

  await handler(makeContext());                 // 1st → calls Gemini, caches result
  const res  = await handler(makeContext());   // 2nd → cache hit
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.cached, true);
  assert.equal(callCount, 1, 'Gemini must only be called once when the second request hits cache');
});

test('broadcast: cache hit response still includes translations and plainLanguage', async () => {
  const store   = new Map();
  const handler = createHandler({ callGemini: async () => GOOD_AI_RESPONSE, _rateLimitStore: new Map(), _cacheStore: store });
  await handler(makeContext());
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.ok(Array.isArray(body.translations));
  assert.equal(typeof body.plainLanguage, 'string');
});

test('broadcast: 400 when message is missing', async () => {
  const handler = createHandler({ callGemini: async () => GOOD_AI_RESPONSE, _rateLimitStore: new Map(), _cacheStore: new Map() });
  const res  = await handler(makeContext({ languages: ['es'] }));
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.ok(typeof body.error === 'string');
});

test('broadcast: 400 when languages array is invalid (uppercase code)', async () => {
  const handler = createHandler({ callGemini: async () => GOOD_AI_RESPONSE, _rateLimitStore: new Map(), _cacheStore: new Map() });
  const res  = await handler(makeContext({ message: 'Gate A open.', languages: ['ES', 'fr'] }));
  assert.equal(res.status, 400);
});

test('broadcast: 429 when rate limit exceeded', async () => {
  const store   = new Map();
  const handler = createHandler({ callGemini: async () => GOOD_AI_RESPONSE, _rateLimitStore: store, _cacheStore: new Map(), _maxRequests: 1 });
  await handler(makeContext());
  const res  = await handler(makeContext());
  assert.equal(res.status, 429);
});

test('broadcast: 502 when Gemini returns malformed JSON', async () => {
  const handler = createHandler({
    callGemini: async () => 'This is not JSON at all!',
    _rateLimitStore: new Map(),
    _cacheStore:     new Map(),
  });
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 502);
  assert.ok(body.error.toLowerCase().includes('malformed'));
});

test('broadcast: 502 when AI JSON is missing "translations" key', async () => {
  const handler = createHandler({
    callGemini: async () => JSON.stringify({ plainLanguage: 'Hello.', other: [] }),
    _rateLimitStore: new Map(),
    _cacheStore:     new Map(),
  });
  const res  = await handler(makeContext());
  assert.equal(res.status, 502);
});

test('broadcast: response translations count matches requested language count', async () => {
  const handler = createHandler({
    callGemini: async () => GOOD_AI_RESPONSE, // returns 2 translations for ['es','fr']
    _rateLimitStore: new Map(),
    _cacheStore:     new Map(),
  });
  const res  = await handler(makeContext({ message: 'Test.', languages: ['es', 'fr'] }));
  const body = await res.json();
  assert.equal(body.translations.length, 2);
});
