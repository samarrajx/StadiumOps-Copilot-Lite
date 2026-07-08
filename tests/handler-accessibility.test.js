/**
 * @file handler-accessibility.test.js
 * Tests for /functions/api/accessibility.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/api/accessibility.js';

// The handler derives its own signals (server-side), so the request body is minimal.
function makeContext(opts = {}) {
  const request = new Request('http://localhost/api/accessibility', {
    method: 'POST',
    headers: {
      'Content-Type':     'application/json',
      'origin':           opts.origin ?? 'http://localhost:8788',
      'cf-connecting-ip': opts.ip ?? '10.0.0.5',
    },
    body: '{}',
  });
  return { request, env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' } };
}

// A realistic AI response — IDs must match those in the server-derived signals.
// Because the handler uses generateLiveSignals() which is deterministic based on
// elapsed time, we can't know the exact IDs at test time. Instead we inspect the
// merged output for the correct shape, and test the 502 paths with a known bad ID.
//
// For the success test we accept any valid ranked array from the handler.
// ASSUMPTION: The first-half phase always has > 0 accessibility requests per P2.

// Build a fake Gemini that returns ranked items matching real signals IDs.
// We intercept which request IDs the handler sends to Gemini by reading the userPrompt.
function makeDynamicGemini() {
  let capturedIds = [];
  const gemini = async ({ userPrompt }) => {
    // Parse the IDs out of the prompt text (they appear as id="AR-XXX")
    const matches = [...userPrompt.matchAll(/id="([^"]+)"/g)];
    capturedIds = matches.map((m) => m[1]);
    const ranked = capturedIds.map((id, i) => ({
      id,
      urgencyRank: i + 1,
      suggestedAction: `Send an escort to ${id} immediately.`,
    }));
    return JSON.stringify({ ranked });
  };
  return { gemini, getCapturedIds: () => capturedIds };
}

// ---------------------------------------------------------------------------

test('accessibility: 200 success returns { ranked: array }', async () => {
  const { gemini } = makeDynamicGemini();
  const handler = createHandler({ callGemini: gemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.ranked), 'body.ranked must be an array');
});

test('accessibility: ranked items have merged urgencyRank and suggestedAction fields', async () => {
  const { gemini } = makeDynamicGemini();
  const handler = createHandler({ callGemini: gemini, _rateLimitStore: new Map() });
  const res  = await handler(makeContext());
  const body = await res.json();
  // In first-half phase, signals include accessibility requests with ranks/actions merged
  if (body.ranked.length > 0) {
    const item = body.ranked[0];
    assert.ok(typeof item.urgencyRank === 'number', 'urgencyRank must be a number');
    assert.ok(typeof item.suggestedAction === 'string', 'suggestedAction must be a string');
    // Also verify original fields are preserved after merge
    assert.ok(typeof item.id === 'string', 'id must be present from original record');
    assert.ok(typeof item.type === 'string', 'type must be preserved from original record');
  }
});

test('accessibility: 429 when rate limit exceeded', async () => {
  const { gemini } = makeDynamicGemini();
  const store   = new Map();
  const handler = createHandler({ callGemini: gemini, _rateLimitStore: store, _maxRequests: 1 });
  await handler(makeContext());
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 429);
  assert.ok(body.error.length > 0);
});

test('accessibility: 502 when Gemini returns non-JSON text', async () => {
  const handler = createHandler({
    callGemini: async () => 'Sorry, I cannot assist with that.',
    _rateLimitStore: new Map(),
  });
  const res  = await handler(makeContext());
  const body = await res.json();
  assert.equal(res.status, 502);
  assert.ok(body.error.toLowerCase().includes('malformed'));
});

test('accessibility: 502 when AI JSON is missing "ranked" key', async () => {
  const handler = createHandler({
    callGemini: async () => JSON.stringify({ priorities: [] }),
    _rateLimitStore: new Map(),
  });
  const res = await handler(makeContext());
  assert.equal(res.status, 502);
});

test('accessibility: 502 when AI returns invented ID not in original requests', async () => {
  const handler = createHandler({
    callGemini: async () => JSON.stringify({
      ranked: [{ id: 'INVENTED-999', urgencyRank: 1, suggestedAction: 'Act now.' }],
    }),
    _rateLimitStore: new Map(),
  });
  const res = await handler(makeContext());
  // The invented ID is not in the input set → shape validation rejects it → 502
  assert.equal(res.status, 502);
});

test('accessibility: CORS header matches request origin', async () => {
  const { gemini } = makeDynamicGemini();
  const handler = createHandler({ callGemini: gemini, _rateLimitStore: new Map() });
  const res = await handler(makeContext({ origin: 'https://control.example.com' }));
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://control.example.com');
});
