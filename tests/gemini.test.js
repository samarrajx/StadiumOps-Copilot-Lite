/**
 * @file gemini.test.js
 * Tests for /functions/_lib/gemini.js
 *
 * Strategy: inject a fake globalThis.fetch before each test, restore it
 * in a finally block. No network calls are made; all responses are mocked.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callGemini, getGeminiModel } from '../functions/_lib/gemini.js';

// ---------------------------------------------------------------------------
// Mock-fetch helpers
// ---------------------------------------------------------------------------

/** A well-formed Gemini success response body for a given text reply. */
function okBody(text) {
  return {
    candidates: [
      { content: { parts: [{ text }] } },
    ],
  };
}

/** Builds a fake Response-like object with ok=true and a json() that resolves. */
function mockOk(body) {
  return { ok: true, status: 200, json: async () => body };
}

/** Builds a fake Response-like object with ok=false. */
function mockErr(status) {
  return { ok: false, status, json: async () => ({ error: 'server error' }) };
}

/** Builds a fake Response-like object where json() rejects (malformed body). */
function mockMalformedJson() {
  return {
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
  };
}

/**
 * Runs `fn` with globalThis.fetch replaced by `mockFetch`, restoring it afterward.
 * Returns the result or re-throws any error after restoring.
 */
async function withMockFetch(mockFetch, fn) {
  const saved = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = saved;
  }
}

// Shared call args for most tests
const CALL_ARGS = {
  apiKey:       'test-api-key-abc123',
  model:        'gemini-2.5-flash',
  systemPrompt: 'You are a helpful assistant.',
  userPrompt:   'What is the gate status?',
};

// ============================================================================
// callGemini — success
// ============================================================================

test('callGemini: returns text from candidates[0].content.parts[0].text', async () => {
  const result = await withMockFetch(
    async () => mockOk(okBody('Gate D is busy.')),
    () => callGemini(CALL_ARGS),
  );
  assert.equal(result, 'Gate D is busy.');
});

test('callGemini: sends POST with correct URL containing model name', async () => {
  let capturedUrl = null;
  await withMockFetch(
    async (url) => { capturedUrl = url; return mockOk(okBody('ok')); },
    () => callGemini(CALL_ARGS),
  );
  assert.ok(capturedUrl.includes('gemini-2.5-flash'), 'URL must contain model name');
  assert.ok(capturedUrl.includes('generateContent'), 'URL must include generateContent endpoint');
  assert.ok(capturedUrl.includes('generativelanguage.googleapis.com'), 'URL must point to Gemini API');
});

test('callGemini: sends correct body shape including systemInstruction and contents', async () => {
  let capturedBody = null;
  await withMockFetch(
    async (_url, opts) => { capturedBody = JSON.parse(opts.body); return mockOk(okBody('ok')); },
    () => callGemini({ ...CALL_ARGS, systemPrompt: 'sys', userPrompt: 'usr' }),
  );
  assert.equal(capturedBody.systemInstruction.parts[0].text, 'sys');
  assert.equal(capturedBody.contents[0].role, 'user');
  assert.equal(capturedBody.contents[0].parts[0].text, 'usr');
  assert.deepEqual(capturedBody.generationConfig, {}, 'jsonMode=false should produce empty generationConfig');
});

test('callGemini: sets responseMimeType when jsonMode is true', async () => {
  let capturedBody = null;
  await withMockFetch(
    async (_url, opts) => { capturedBody = JSON.parse(opts.body); return mockOk(okBody('{}')) ; },
    () => callGemini({ ...CALL_ARGS, jsonMode: true }),
  );
  assert.equal(capturedBody.generationConfig.responseMimeType, 'application/json');
});

// ============================================================================
// callGemini — HTTP errors
// ============================================================================

test('callGemini: throws on non-200 status and includes status code in message', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => mockErr(429),
      () => callGemini(CALL_ARGS),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('429'), `expected "429" in error: "${err.message}"`);
      return true;
    },
  );
});

test('callGemini: error message MUST NOT contain the API key', async () => {
  const sensitiveKey = 'SUPER_SECRET_KEY_XYZ';
  await assert.rejects(
    () => withMockFetch(
      async () => mockErr(500),
      () => callGemini({ ...CALL_ARGS, apiKey: sensitiveKey }),
    ),
    (err) => {
      assert.ok(!err.message.includes(sensitiveKey),
        `API key must not appear in error message, got: "${err.message}"`);
      return true;
    },
  );
});

// ============================================================================
// callGemini — malformed / incomplete responses
// ============================================================================

test('callGemini: throws a clear error when response body is malformed JSON', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => mockMalformedJson(),
      () => callGemini(CALL_ARGS),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.toLowerCase().includes('malformed') ||
        err.message.toLowerCase().includes('json'),
        `expected "malformed" or "json" in error: "${err.message}"`,
      );
      return true;
    },
  );
});

test('callGemini: throws when candidates array is empty', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => mockOk({ candidates: [] }),
      () => callGemini(CALL_ARGS),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.toLowerCase().includes('candidate'),
        `expected "candidate" in error: "${err.message}"`,
      );
      return true;
    },
  );
});

test('callGemini: throws when candidates is missing entirely', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => mockOk({ somethingElse: true }),
      () => callGemini(CALL_ARGS),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

test('callGemini: throws when text field is missing from parts', async () => {
  const bodyWithNoText = {
    candidates: [{ content: { parts: [{ /* no text field */ }] } }],
  };
  await assert.rejects(
    () => withMockFetch(
      async () => mockOk(bodyWithNoText),
      () => callGemini(CALL_ARGS),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

// ============================================================================
// callGemini — network failure
// ============================================================================

test('callGemini: propagates network-level fetch rejection as an Error', async () => {
  await assert.rejects(
    () => withMockFetch(
      async () => { throw new TypeError('Failed to fetch'); },
      () => callGemini(CALL_ARGS),
    ),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.toLowerCase().includes('network') ||
        err.message.toLowerCase().includes('fetch'),
        `expected "network" or "fetch" in error: "${err.message}"`,
      );
      return true;
    },
  );
});

// ============================================================================
// getGeminiModel
// ============================================================================

test('getGeminiModel: returns "gemini-2.5-flash" when env is undefined', () => {
  assert.equal(getGeminiModel(undefined), 'gemini-2.5-flash');
});

test('getGeminiModel: returns "gemini-2.5-flash" when env.GEMINI_MODEL is absent', () => {
  assert.equal(getGeminiModel({}), 'gemini-2.5-flash');
});

test('getGeminiModel: returns "gemini-2.5-flash" when env.GEMINI_MODEL is empty string', () => {
  assert.equal(getGeminiModel({ GEMINI_MODEL: '' }), 'gemini-2.5-flash');
});

test('getGeminiModel: returns env.GEMINI_MODEL when it is set to a non-empty string', () => {
  assert.equal(
    getGeminiModel({ GEMINI_MODEL: 'gemini-1.5-pro' }),
    'gemini-1.5-pro',
  );
});
