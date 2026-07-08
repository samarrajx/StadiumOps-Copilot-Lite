/**
 * @file api.js
 * Thin fetch wrappers for all StadiumOps Copilot API endpoints.
 * Every function returns a parsed JSON response or throws a human-readable Error.
 * No raw, unhandled promise rejections — all failure paths throw proper Errors.
 *
 * Paths match the /functions/api/ route handlers from P8 exactly.
 */

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * POSTs `body` as JSON to `path` and returns the parsed response.
 * Throws a proper Error (never a raw rejection) on any failure:
 *   - Network error → Error('Network error: <message>')
 *   - Non-OK HTTP  → Error(response.body.error ?? `Request failed …`)
 *   - Unreadable body → Error('Server returned an unreadable response …')
 *
 * @param {string} path - Absolute or root-relative URL path.
 * @param {object} body - Request payload to JSON-encode.
 * @returns {Promise<object>} Parsed response JSON.
 */
export async function postJson(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    // Network-level failure (DNS, connection refused, CORS preflight failure, etc.)
    throw new Error(`Network error: ${networkErr.message}`);
  }

  // Always attempt to parse JSON — error responses carry a body.error field
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Server returned an unreadable response (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    // Prefer the server's human-readable error message; fall back to status code
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}.`,
    );
  }

  return data;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers — each maps 1:1 to a /functions/api/ handler
// ---------------------------------------------------------------------------

/**
 * Fetches a 3-5 sentence operational situation report from the server.
 * Server re-derives live signals; no payload needed.
 * @returns {Promise<{ briefing: string }>}
 */
export async function fetchBriefing() {
  return postJson('/api/briefing', {});
}

/**
 * Sends a question (and optional conversation history) to the Decision Assistant.
 * @param {string}  question - Organizer's question (1-500 chars).
 * @param {Array}   [history=[]] - Prior conversation turns [{role, content}].
 * @returns {Promise<{ answer: string }>}
 */
export async function fetchAssistantAnswer(question, history = []) {
  return postJson('/api/assistant', { question, history });
}

/**
 * Fetches the single best gate recommendation for current conditions.
 * Server re-derives live signals; no payload needed.
 * @returns {Promise<{ recommendation: string }>}
 */
export async function fetchGateRecommendation() {
  return postJson('/api/gate-recommend', {});
}

/**
 * Translates a broadcast message into the requested languages.
 * @param {string}   message   - Operator message to translate (1-300 chars).
 * @param {string[]} languages - ISO 639-1 language codes (1-6, no duplicates).
 * @returns {Promise<{ translations: Array, plainLanguage: string, cached: boolean }>}
 */
export async function fetchBroadcast(message, languages) {
  return postJson('/api/broadcast', { message, languages });
}

/**
 * Fetches AI-ranked accessibility requests with suggested actions.
 * Server re-derives live signals; no payload needed.
 * @returns {Promise<{ ranked: Array }>}
 */
export async function fetchAccessibilityInsights() {
  return postJson('/api/accessibility', {});
}
