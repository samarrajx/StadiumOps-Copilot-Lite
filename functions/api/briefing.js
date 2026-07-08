/**
 * @file briefing.js
 * POST /api/briefing
 * Re-derives live signals server-side, generates a 3-5 sentence situation report.
 * No meaningful request body needed (POST for rate-limit consistency).
 * Returns: { briefing: string }
 */

import { generateLiveSignals } from '../../public/js/liveSignals.js';
import { buildBriefingPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import {
  applyRateLimit, makeCorsHeaders, jsonResponse, getMatchStartMs, SYSTEM_PROMPT,
} from '../_lib/guard.js';

const MAX_REQUESTS = 20;
const WINDOW_MS    = 60_000;

// Module-level store owned by this function's warm isolate lifecycle.
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

    // 2. Re-derive live signals server-side (client body intentionally unused)
    const signals = generateLiveSignals(nowMs, getMatchStartMs(nowMs));

    // 3. Build prompt and call Gemini
    let briefing;
    try {
      briefing = await callGemini({
        apiKey:       env.GEMINI_API_KEY,
        model:        getGeminiModel(env),
        systemPrompt: SYSTEM_PROMPT,
        userPrompt:   buildBriefingPrompt(signals),
      });
    } catch {
      // Do not expose env.GEMINI_API_KEY or raw error in response
      return jsonResponse({ error: 'AI service unavailable. Please try again.' }, 503, cors);
    }

    return jsonResponse({ briefing }, 200, cors);
  };
}

export const onRequestPost = createHandler();
