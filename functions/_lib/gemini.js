/**
 * @file gemini.js
 * Thin wrapper around the Gemini REST API using plain fetch.
 * No @google/generative-ai SDK — direct HTTPS calls only (P0 requirement).
 *
 * SECURITY:
 *  - The API key is passed via the URL query string (?key=…) which is the
 *    Gemini REST convention. It is NEVER logged or included in thrown error
 *    messages — errors reference only the HTTP status code.
 *  - This module runs inside /functions only (server-side). It must never be
 *    imported by any /public file.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ASSUMPTION: The default model name is the only place in the codebase where
// a model string is hard-coded, per P0. All other call sites read from env.
const DEFAULT_MODEL = 'gemini-2.5-flash';

// ---------------------------------------------------------------------------
// callGemini
// ---------------------------------------------------------------------------

/**
 * Sends a single-turn prompt to the Gemini generateContent endpoint.
 *
 * @param {object}  opts
 * @param {string}  opts.apiKey      - Gemini API key (from env binding, never logged).
 * @param {string}  opts.model       - Model name (e.g. "gemini-2.5-flash").
 * @param {string}  opts.systemPrompt - System instruction text.
 * @param {string}  opts.userPrompt   - User turn text.
 * @param {boolean} [opts.jsonMode=false] - If true, requests application/json MIME type.
 * @returns {Promise<string>}         - The model's text reply.
 * @throws {Error}                    - On HTTP error, malformed response, or network failure.
 */
export async function callGemini({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  jsonMode = false,
}) {
  if (!apiKey) {
    throw new Error('Server configuration error: GEMINI_API_KEY is not set in environment variables.');
  }

  // Build the URL — apiKey goes in the query string per Gemini REST convention.
  // Never include apiKey in any thrown Error message or log statement.
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: jsonMode ? { responseMimeType: 'application/json' } : {},
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    // Network-level failure (DNS, connection refused, etc.)
    throw new Error(`Gemini API network error: ${networkErr.message}`);
  }

  if (!response.ok) {
    // Only include status code — never the URL (which contains the API key).
    throw new Error(`Gemini API error: HTTP ${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Gemini API returned malformed JSON');
  }

  // Validate response shape before any property access to avoid
  // silent undefined propagation.
  const candidates = data?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Gemini API returned no candidates');
  }

  const text = candidates[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini API response missing expected text field in candidates[0].content.parts[0]');
  }

  return text;
}

// ---------------------------------------------------------------------------
// getGeminiModel
// ---------------------------------------------------------------------------

/**
 * Resolves the Gemini model name from the environment binding.
 * Falls back to the single allowed hardcoded default when the env var is absent.
 *
 * @param {object|undefined} env - Cloudflare Pages Functions env bindings object.
 * @returns {string}             - Model name to use.
 */
export function getGeminiModel(env) {
  const model = env?.GEMINI_MODEL;
  return typeof model === 'string' && model.length > 0 ? model : DEFAULT_MODEL;
}
