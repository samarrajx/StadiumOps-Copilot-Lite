/**
 * @file gate-recommend.js
 * POST /api/gate-recommend
 * Re-derives live signals server-side (any client-sent signals are ignored),
 * returns a single best gate recommendation for fan routing.
 * Returns: { recommendation: string }
 */

import { buildAssistantPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import {
  jsonResponse, SYSTEM_PROMPT, handleRouteStandard,
} from '../_lib/guard.js';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../_lib/constants.js';


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

    // 2. Build prompt and call Gemini
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
