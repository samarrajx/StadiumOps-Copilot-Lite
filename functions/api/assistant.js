/**
 * @file assistant.js
 * POST /api/assistant
 * Validates question + optional history, re-derives live signals server-side,
 * calls Gemini Decision Assistant.
 * Returns: { answer: string }
 */

import { buildAssistantPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import { validateQuestion, validateConversationHistory } from '../../public/js/utils/validators.js';
import {
  jsonResponse, SYSTEM_PROMPT, handleRouteStandard, parseJsonBody,
} from '../_lib/guard.js';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../_lib/constants.js';


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

    // 2. Parse + validate body
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) {
      return jsonResponse({ error: parsed.error }, 400, cors);
    }
    const { question, history = [] } = parsed.data ?? {};

    const qv = validateQuestion(question);
    if (!qv.valid) return jsonResponse({ error: qv.error }, 400, cors);

    const hv = validateConversationHistory(history);
    if (!hv.valid) return jsonResponse({ error: hv.error }, 400, cors);

    // 4. Build prompt and call Gemini
    // question is passed explicitly labeled as untrusted inside buildAssistantPrompt
    let answer;
    try {
      answer = await callGemini({
        apiKey:       env.GEMINI_API_KEY,
        model:        getGeminiModel(env),
        systemPrompt: SYSTEM_PROMPT,
        userPrompt:   buildAssistantPrompt(signals, qv.value, hv.value),
      });
    } catch (err) {
      return jsonResponse({ error: err.message || 'AI service unavailable. Please try again.' }, 503, cors);
    }

    return jsonResponse({ answer }, 200, cors);
  };
}

export const onRequestPost = createHandler();
