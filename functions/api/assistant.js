/**
 * @file assistant.js
 * POST /api/assistant
 * Validates question + optional history, re-derives live signals server-side,
 * calls Gemini Decision Assistant.
 * Returns: { answer: string }
 */

import { generateLiveSignals } from '../../public/js/liveSignals.js';
import { buildAssistantPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import { validateQuestion, validateConversationHistory } from '../../public/js/utils/validators.js';
import {
  applyRateLimit, makeCorsHeaders, jsonResponse, parseJsonBody,
  getMatchStartMs, SYSTEM_PROMPT,
} from '../_lib/guard.js';

const MAX_REQUESTS = 20;
const WINDOW_MS    = 60_000;

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

    // 3. Re-derive live signals server-side
    const signals = generateLiveSignals(nowMs, getMatchStartMs(nowMs));

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
