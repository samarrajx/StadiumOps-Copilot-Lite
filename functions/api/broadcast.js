/**
 * @file broadcast.js
 * POST /api/broadcast
 * Validates operator message + language codes, checks broadcast translation
 * cache before calling Gemini (JSON mode), validates AI response shape,
 * caches result.
 * Returns: { translations: [{lang, text}], plainLanguage: string, cached: boolean }
 */

import { buildBroadcastPrompt } from '../_lib/prompts.js';
import { callGemini as _callGemini, getGeminiModel } from '../_lib/gemini.js';
import { validateBroadcastMessage, validateLanguageCodes } from '../../public/js/utils/validators.js';
import { makeCacheKey, getCached, setCached } from '../_lib/cache.js';
import {
  jsonResponse, SYSTEM_PROMPT, handleRouteStandard, parseJsonBody,
} from '../_lib/guard.js';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS, BROADCAST_CACHE_TTL_MS } from '../_lib/constants.js';


const rateLimitStore    = new Map();
const broadcastCacheStore = new Map();

// ---------------------------------------------------------------------------
// Response-shape validation
// ---------------------------------------------------------------------------

function isValidBroadcastShape(data) {
  if (!Array.isArray(data?.translations)) return false;
  if (typeof data?.plainLanguage !== 'string') return false;
  for (const item of data.translations) {
    if (typeof item?.lang !== 'string' || typeof item?.text !== 'string') return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Testable handler factory
// ---------------------------------------------------------------------------

export function createHandler({
  callGemini     = _callGemini,
  _rateLimitStore  = rateLimitStore,
  _cacheStore    = broadcastCacheStore,
  _maxRequests   = RATE_LIMIT_MAX_REQUESTS,
  _windowMs      = RATE_LIMIT_WINDOW_MS,
  _cacheTTL      = BROADCAST_CACHE_TTL_MS,
} = {}) {
  return async function handler(context) {
    const { request, env } = context;
    const nowMs = Date.now();

    // 1. Run standard rate limit, CORS, and signals generation
    const std = handleRouteStandard({
      request,
      rateLimitStore: _rateLimitStore,
      maxRequests: _maxRequests,
      windowMs: _windowMs,
      nowMs,
    });
    if (!std.ok) return std.errorResponse;
    const { cors } = std;

    // 2. Parse + validate body
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400, cors);

    const { message, languages } = parsed.data ?? {};

    const mv = validateBroadcastMessage(message);
    if (!mv.valid) return jsonResponse({ error: mv.error }, 400, cors);

    const lv = validateLanguageCodes(languages);
    if (!lv.valid) return jsonResponse({ error: lv.error }, 400, cors);

    // 3. Cache check (key is deterministic from message + sorted language codes)
    const cacheKey = makeCacheKey(mv.value, lv.value);
    const cached = getCached(_cacheStore, cacheKey, _cacheTTL, nowMs);
    if (cached != null) {
      return jsonResponse({ ...cached, cached: true }, 200, cors);
    }

    // 4. Call Gemini in JSON mode
    let rawText;
    try {
      rawText = await callGemini({
        apiKey:       env.GEMINI_API_KEY,
        model:        getGeminiModel(env),
        systemPrompt: SYSTEM_PROMPT,
        userPrompt:   buildBroadcastPrompt(mv.value, lv.value),
        jsonMode:     true,
      });
    } catch (err) {
      return jsonResponse({ error: err.message || 'AI service unavailable. Please try again.' }, 503, cors);
    }

    // 5. Parse + validate AI JSON response — never let malformed output reach client
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return jsonResponse({ error: 'AI response was malformed. Please try again.' }, 502, cors);
    }

    if (!isValidBroadcastShape(data)) {
      return jsonResponse({ error: 'AI response was malformed. Please try again.' }, 502, cors);
    }

    // 6. Cache and return
    const payload = { translations: data.translations, plainLanguage: data.plainLanguage };
    setCached(_cacheStore, cacheKey, payload, nowMs);
    return jsonResponse({ ...payload, cached: false }, 200, cors);
  };
}

export const onRequestPost = createHandler();
