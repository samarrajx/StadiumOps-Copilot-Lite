/**
 * @file gate-recommend.js
 * POST /api/gate-recommend
 * Re-derives live signals server-side (any client-sent signals are ignored),
 * returns a single best gate recommendation for fan routing.
 * Returns: { recommendation: string }
 */

import { generateLiveSignals } from '../../public/js/liveSignals.js';
import { buildAssistantPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import {
  applyRateLimit, makeCorsHeaders, jsonResponse, getMatchStartMs, SYSTEM_PROMPT,
} from '../_lib/guard.js';

const MAX_REQUESTS = 20;
const WINDOW_MS    = 60_000;

// ASSUMPTION: Gate recommendation question is fixed — the AI is asked for the
// single best gate based on current conditions, not a free-form query.
const GATE_RECOMMEND_QUESTION =
  'Based on current gate conditions, which single gate should I recommend ' +
  'to fans right now for fastest entry? Name the gate and zone, state the ' +
  'current wait time, and give one specific operational reason for the choice. ' +
  'If the recommended gate is not wheelchair accessible, also name the nearest ' +
  'accessible alternative.';

const rateLimitStore = new Map();

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

    // 2. Re-derive live signals server-side.
    //    Client request body is intentionally NOT parsed or used —
    //    we never trust client-sent operational state for AI decisions.
    const signals = generateLiveSignals(nowMs, getMatchStartMs(nowMs));

    // 3. Build prompt and call Gemini
    let recommendation;
    try {
      recommendation = await callGemini({
        apiKey:       env.GEMINI_API_KEY,
        model:        getGeminiModel(env),
        systemPrompt: SYSTEM_PROMPT,
        userPrompt:   buildAssistantPrompt(signals, GATE_RECOMMEND_QUESTION, []),
      });
    } catch (err) {
      return jsonResponse({ error: err.message || 'AI service unavailable. Please try again.' }, 503, cors);
    }

    return jsonResponse({ recommendation }, 200, cors);
  };
}

export const onRequestPost = createHandler();
