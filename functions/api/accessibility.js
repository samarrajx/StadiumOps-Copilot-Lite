/**
 * @file accessibility.js
 * POST /api/accessibility
 * Re-derives live signals server-side, ranks open accessibility requests via
 * Gemini (JSON mode), merges AI-ranked metadata back onto original records.
 * Returns: { ranked: [{ id, type, gateId, minutesOpen, status, note,
 *                        urgencyRank, suggestedAction }] }
 */

import { generateLiveSignals } from '../../public/js/liveSignals.js';
import { buildAccessibilityPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import {
  applyRateLimit, makeCorsHeaders, jsonResponse, getMatchStartMs, SYSTEM_PROMPT,
} from '../_lib/guard.js';

const MAX_REQUESTS = 20;
const WINDOW_MS    = 60_000;

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
  _maxRequests  = MAX_REQUESTS,
  _windowMs     = WINDOW_MS,
} = {}) {
  return async function handler(context) {
    const { request, env } = context;
    const cors = makeCorsHeaders(request);
    const nowMs = Date.now();

    // 1. Rate limit
    const limitRes = applyRateLimit(_rateLimitStore, request, _maxRequests, _windowMs, nowMs);
    if (limitRes) return limitRes;

    // 2. Re-derive live signals server-side to get accessibility requests
    const signals = generateLiveSignals(nowMs, getMatchStartMs(nowMs));
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
