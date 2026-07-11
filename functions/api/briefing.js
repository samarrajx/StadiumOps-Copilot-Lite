/**
 * @file briefing.js
 * POST /api/briefing
 * Re-derives live signals server-side, generates a 3-5 sentence situation report.
 * No meaningful request body needed (POST for rate-limit consistency).
 * Returns: { briefing: string }
 */

import { buildBriefingPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import {
  jsonResponse, SYSTEM_PROMPT, handleRouteStandard,
} from '../_lib/guard.js';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../_lib/constants.js';


// Module-level store owned by this function's warm isolate lifecycle.
const rateLimitStore = new Map();

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

    // 3. Build prompt and call Gemini
    let briefing;
    try {
      briefing = await callGemini({
        apiKey:       env.GEMINI_API_KEY,
        model:        getGeminiModel(env),
        systemPrompt: SYSTEM_PROMPT,
        userPrompt:   buildBriefingPrompt(signals),
      });
    } catch (err) {
      // Do not expose env.GEMINI_API_KEY or raw error in response
      return jsonResponse({ error: err.message || 'AI service unavailable. Please try again.' }, 503, cors);
    }

    return jsonResponse({ briefing }, 200, cors);
  };
}

export const onRequestPost = createHandler();
