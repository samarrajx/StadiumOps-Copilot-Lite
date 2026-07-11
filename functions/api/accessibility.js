/**
 * @file accessibility.js
 * POST /api/accessibility
 * Re-derives live signals server-side, ranks open accessibility requests via
 * Gemini (JSON mode), merges AI-ranked metadata back onto original records.
 * Returns: { ranked: [{ id, type, gateId, minutesOpen, status, note,
 *                        urgencyRank, suggestedAction }] }
 */

import { buildAccessibilityPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import {
  jsonResponse, SYSTEM_PROMPT, handleRouteStandard,
} from '../_lib/guard.js';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../_lib/constants.js';


const rateLimitStore = new Map();

// ---------------------------------------------------------------------------
// Response-shape validation
// ---------------------------------------------------------------------------

function isValidAccessibilityShape(data, inputIds) {
  if (!Array.isArray(data?.ranked)) return false;
  const idSet = new Set(inputIds);
  for (const item of data.ranked) {
    if (typeof item?.id !== 'string')            return false;
    if (typeof item?.urgencyRank !== 'number')   return false;
    if (typeof item?.suggestedAction !== 'string') return false;
    // Reject invented IDs — model must only reference input request ids
    if (!idSet.has(item.id))                     return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Testable handler factory
// ---------------------------------------------------------------------------

export function createHandler({
  callGemini    = _callGemini,
  _rateLimitStore = rateLimitStore,
  _maxRequests  = RATE_LIMIT_MAX_REQUESTS,
  _windowMs     = RATE_LIMIT_WINDOW_MS,
} = {}) {
  return async function handler(context) {
    const { request, env } = context;

    // 1. Run standard rate limit, CORS, and signals generation
    const std = handleRouteStandard({
      request,
      rateLimitStore: _rateLimitStore,
      maxRequests: _maxRequests,
      windowMs: _windowMs,
      nowMs: Date.now(),
    });
    if (!std.ok) return std.errorResponse;
    const { signals, cors } = std;

    const openRequests = signals.accessibilityRequests ?? [];

    // Short-circuit: if no open requests, return empty ranked list immediately
    if (openRequests.length === 0) {
      return jsonResponse({ ranked: [] }, 200, cors);
    }

    // 3. Call Gemini in JSON mode
    let rawText;
    try {
      rawText = await callGemini({
        apiKey:       env.GEMINI_API_KEY,
        model:        getGeminiModel(env),
        systemPrompt: SYSTEM_PROMPT,
        userPrompt:   buildAccessibilityPrompt(openRequests),
        jsonMode:     true,
      });
    } catch (err) {
      return jsonResponse({ error: err.message || 'AI service unavailable. Please try again.' }, 503, cors);
    }

    // 4. Parse + validate AI JSON response
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return jsonResponse({ error: 'AI response was malformed. Please try again.' }, 502, cors);
    }

    const inputIds = openRequests.map((r) => r.id);
    if (!isValidAccessibilityShape(data, inputIds)) {
      return jsonResponse({ error: 'AI response was malformed. Please try again.' }, 502, cors);
    }

    // 5. Merge AI-provided urgencyRank + suggestedAction back onto original records
    const requestMap = new Map(openRequests.map((r) => [r.id, r]));
    const ranked = data.ranked.map((item) => ({
      ...requestMap.get(item.id),
      urgencyRank:     item.urgencyRank,
      suggestedAction: item.suggestedAction,
    }));

    return jsonResponse({ ranked }, 200, cors);
  };
}

export const onRequestPost = createHandler();
