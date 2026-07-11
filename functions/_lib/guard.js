/**
 * @file guard.js
 * Shared pure utilities for route-handler guard logic.
 * No module-level state — everything is a pure function of its arguments.
 */

import { checkRateLimit, getClientKey } from './rateLimit.js';
import { MATCH_START_OFFSET_MS } from './constants.js';

/**
 * Reads the Origin header from a request (for same-origin CORS).
 * @param {Request} request
 * @returns {string} Origin string, or '' if absent.
 */
export function getRequestOrigin(request) {
  return request.headers.get('origin') ?? '';
}

/**
 * Builds a minimal set of CORS headers restricted to the request's own origin.
 * Never returns Access-Control-Allow-Origin: *.
 * @param {Request} request
 * @returns {object}
 */
export function makeCorsHeaders(request) {
  const origin = getRequestOrigin(request);
  return origin ? { 'Access-Control-Allow-Origin': origin } : {};
}

/**
 * Creates a JSON Response with correct Content-Type and optional extra headers.
 * @param {object} body
 * @param {number} status
 * @param {object} [extraHeaders={}]
 * @returns {Response}
 */
export function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/**
 * Checks the sliding-window rate limit for the incoming request.
 * Returns a 429 Response if blocked, or null if the request is allowed.
 *
 * @param {Map}     store
 * @param {Request} request
 * @param {number}  maxRequests
 * @param {number}  windowMs
 * @param {number}  nowMs
 * @returns {Response|null}
 */
export function applyRateLimit(store, request, maxRequests, windowMs, nowMs) {
  const key = getClientKey(request.headers);
  const { allowed, retryAfterMs } = checkRateLimit(store, key, maxRequests, windowMs, nowMs);
  if (allowed) return null;
  return jsonResponse(
    { error: 'Too many requests. Please slow down.' },
    429,
    {
      'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
      ...makeCorsHeaders(request),
    },
  );
}

/**
 * Safely parses a Request's JSON body.
 * Returns { ok: true, data } on success, { ok: false, error } on failure.
 * @param {Request} request
 * @returns {Promise<{ok:boolean, data?:unknown, error?:string}>}
 */
export async function parseJsonBody(request) {
  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Request body must be valid JSON.' };
  }
}

/**
 * Derives a demo match-start timestamp from the current time.
 * Returns a moment 30 minutes before `nowMs` so the app prototype is always
 * in the "first-half" phase regardless of when it is loaded.
 *
 * ASSUMPTION: Production would fetch the real kick-off time from a fixture
 * or schedule API keyed to the actual match.
 *
 * @param {number} [nowMs=Date.now()] - Current timestamp in milliseconds.
 * @returns {number} Match start timestamp in milliseconds.
 */
export function getMatchStartMs(nowMs = Date.now()) {
  return nowMs - MATCH_START_OFFSET_MS;
}

// Common Gemini system prompt used by all handlers.
// Detailed operational instructions are embedded in the user-turn prompt
// by each buildXxxPrompt function in prompts.js.
export const SYSTEM_PROMPT =
  'You are a FIFA World Cup 2026 stadium operations AI assistant. ' +
  'Follow all instructions provided in the user message precisely.';
