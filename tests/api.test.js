/**
 * @file api.test.js
 * Tests for /public/js/api.js
 *
 * Uses save/restore globalThis.fetch per-test (same pattern as gemini.test.js).
 * Covers: postJson core behaviour + all five endpoint wrapper functions.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  postJson,
  fetchBriefing,
  fetchAssistantAnswer,
  fetchGateRecommendation,
  fetchBroadcast,
  fetchAccessibilityInsights,
} from '../public/js/api.js';

// ---------------------------------------------------------------------------
// Mock-fetch helper (save/restore globalThis.fetch)
// ---------------------------------------------------------------------------

async function withMockFetch(mockFn, fn) {
  const saved = globalThis.fetch;
  globalThis.fetch = mockFn;
  try {
    return await fn();
  } finally {
    globalThis.fetch = saved;
  }
}

function mockOk(body) {
  return { ok: true, status: 200, json: async () => body };
}

function mockErr(status, body = {}) {
  return { ok: false, status, json: async () => body };
}

// ---------------------------------------------------------------------------
// postJson — core behaviour
// ---------------------------------------------------------------------------

test('api/postJson: success parses and returns the response JSON', async () => {
  const result = await withMockFetch(
    async () => mockOk({ briefing: 'Gate D is busy.' }),
    () => postJson('/api/briefing', {}),
  );
  assert.deepEqual(result, { briefing: 'Gate D is busy.' });
});

test('api/postJson: non-OK response throws with the server error message', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => mockErr(400, { error: 'Question is required.' }),
      () => postJson('/api/assistant', {}),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'Question is required.');
      return true;
    },
  );
});

test('api/postJson: non-OK with no "error" field throws generic status message', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => mockErr(503, {}),
      () => postJson('/api/briefing', {}),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.includes('503') || err.message.toLowerCase().includes('failed'),
        `expected status or "failed" in: "${err.message}"`,
      );
      return true;
    },
  );
});

test('api/postJson: network-level failure throws a proper Error (not a raw rejection)', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => { throw new TypeError('Failed to fetch'); },
      () => postJson('/api/briefing', {}),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.toLowerCase().includes('network') ||
        err.message.toLowerCase().includes('fetch'),
        `expected "network" or "fetch" in: "${err.message}"`,
      );
      return true;
    },
  );
});

test('api/postJson: sends POST with Content-Type: application/json', async () => {
  let capturedHeaders = null;
  await withMockFetch(
    async (_url, opts) => { capturedHeaders = opts.headers; return mockOk({}); },
    () => postJson('/api/briefing', {}),
  );
  assert.equal(capturedHeaders?.['Content-Type'], 'application/json');
});

// ---------------------------------------------------------------------------
// Endpoint wrappers — correct path and body
// ---------------------------------------------------------------------------

test('api/fetchBriefing: POSTs to /api/briefing with empty body', async () => {
  let capturedUrl, capturedBody;
  await withMockFetch(
    async (url, opts) => { capturedUrl = url; capturedBody = JSON.parse(opts.body); return mockOk({ briefing: 'ok' }); },
    () => fetchBriefing(),
  );
  assert.equal(capturedUrl, '/api/briefing');
  assert.deepEqual(capturedBody, {});
});

test('api/fetchAssistantAnswer: POSTs to /api/assistant with question and history', async () => {
  let capturedUrl, capturedBody;
  const history = [{ role: 'user', content: 'First question.' }];
  await withMockFetch(
    async (url, opts) => { capturedUrl = url; capturedBody = JSON.parse(opts.body); return mockOk({ answer: 'ok' }); },
    () => fetchAssistantAnswer('Is Gate A open?', history),
  );
  assert.equal(capturedUrl, '/api/assistant');
  assert.equal(capturedBody.question, 'Is Gate A open?');
  assert.deepEqual(capturedBody.history, history);
});

test('api/fetchAssistantAnswer: defaults history to [] when omitted', async () => {
  let capturedBody;
  await withMockFetch(
    async (_url, opts) => { capturedBody = JSON.parse(opts.body); return mockOk({ answer: 'ok' }); },
    () => fetchAssistantAnswer('Quick question.'),
  );
  assert.deepEqual(capturedBody.history, []);
});

test('api/fetchGateRecommendation: POSTs to /api/gate-recommend with empty body', async () => {
  let capturedUrl, capturedBody;
  await withMockFetch(
    async (url, opts) => { capturedUrl = url; capturedBody = JSON.parse(opts.body); return mockOk({ recommendation: 'Gate E' }); },
    () => fetchGateRecommendation(),
  );
  assert.equal(capturedUrl, '/api/gate-recommend');
  assert.deepEqual(capturedBody, {});
});

test('api/fetchBroadcast: POSTs to /api/broadcast with message and languages', async () => {
  let capturedUrl, capturedBody;
  await withMockFetch(
    async (url, opts) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      return mockOk({ translations: [], plainLanguage: 'ok', cached: false });
    },
    () => fetchBroadcast('Gate A open.', ['es', 'fr']),
  );
  assert.equal(capturedUrl, '/api/broadcast');
  assert.equal(capturedBody.message, 'Gate A open.');
  assert.deepEqual(capturedBody.languages, ['es', 'fr']);
});

test('api/fetchAccessibilityInsights: POSTs to /api/accessibility with empty body', async () => {
  let capturedUrl, capturedBody;
  await withMockFetch(
    async (url, opts) => { capturedUrl = url; capturedBody = JSON.parse(opts.body); return mockOk({ ranked: [] }); },
    () => fetchAccessibilityInsights(),
  );
  assert.equal(capturedUrl, '/api/accessibility');
  assert.deepEqual(capturedBody, {});
});
