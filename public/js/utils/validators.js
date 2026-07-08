/**
 * @file validators.js
 * Input-shape validators for the StadiumOps Copilot API surface.
 *
 * IMPORTANT: These functions check ONLY type, shape, and length.
 * They intentionally accept any character content, including < > " ' and
 * words like "ignore", "system", or "instructions". Prompt-injection
 * mitigation is a separate concern handled in /functions/_lib/prompts.js (P5).
 * Do NOT add content-filtering here.
 *
 * Every function returns:
 *   { valid: true,  value: <cleaned/parsed value> }  on success
 *   { valid: false, error: <human-readable message> } on failure
 */

// ---------------------------------------------------------------------------
// validateQuestion
// ---------------------------------------------------------------------------

/**
 * Validates a free-text question from a control-room operator.
 *
 * @param {unknown} text - Value to validate.
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
export function validateQuestion(text) {
  if (typeof text !== 'string') {
    return { valid: false, error: 'question must be a string' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'question must not be empty or whitespace-only' };
  }
  if (trimmed.length > 500) {
    return { valid: false, error: 'question must be 500 characters or fewer (trimmed)' };
  }
  return { valid: true, value: trimmed };
}

// ---------------------------------------------------------------------------
// validateBroadcastMessage
// ---------------------------------------------------------------------------

/**
 * Validates a broadcast message to be translated/sent to fans.
 *
 * @param {unknown} text - Value to validate.
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
export function validateBroadcastMessage(text) {
  if (typeof text !== 'string') {
    return { valid: false, error: 'message must be a string' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'message must not be empty or whitespace-only' };
  }
  if (trimmed.length > 300) {
    return { valid: false, error: 'message must be 300 characters or fewer (trimmed)' };
  }
  return { valid: true, value: trimmed };
}

// ---------------------------------------------------------------------------
// validateLanguageCodes
// ---------------------------------------------------------------------------

// ASSUMPTION: ISO 639-1 two-letter lowercase language codes are the expected
// format (e.g. "en", "es", "fr"). Regex /^[a-z]{2}$/ enforces this exactly.
const LANG_CODE_RE = /^[a-z]{2}$/;
const MAX_LANGUAGES = 6;

/**
 * Validates an array of ISO 639-1 two-letter language codes.
 *
 * @param {unknown} codes - Value to validate.
 * @returns {{ valid: boolean, error?: string, value?: string[] }}
 */
export function validateLanguageCodes(codes) {
  if (!Array.isArray(codes)) {
    return { valid: false, error: 'languages must be an array' };
  }
  if (codes.length === 0) {
    return { valid: false, error: 'languages array must not be empty' };
  }
  if (codes.length > MAX_LANGUAGES) {
    return { valid: false, error: `languages array must contain at most ${MAX_LANGUAGES} entries` };
  }
  for (let i = 0; i < codes.length; i++) {
    if (typeof codes[i] !== 'string') {
      return { valid: false, error: `languages[${i}] must be a string` };
    }
    if (!LANG_CODE_RE.test(codes[i])) {
      return { valid: false, error: `languages[${i}] "${codes[i]}" is not a valid ISO 639-1 code (two lowercase letters)` };
    }
  }
  // Check for duplicates
  const seen = new Set(codes);
  if (seen.size !== codes.length) {
    return { valid: false, error: 'languages array must not contain duplicate codes' };
  }
  return { valid: true, value: codes.slice() }; // return a defensive copy
}

// ---------------------------------------------------------------------------
// validateConversationHistory
// ---------------------------------------------------------------------------

const MAX_HISTORY_ITEMS    = 12;
const MAX_HISTORY_CONTENT  = 500;
const VALID_ROLES          = new Set(['user', 'assistant']);

/**
 * Validates a conversation history array (for multi-turn assistant context).
 *
 * @param {unknown} history - Value to validate.
 * @returns {{ valid: boolean, error?: string, value?: Array<{role: string, content: string}> }}
 */
export function validateConversationHistory(history) {
  if (!Array.isArray(history)) {
    return { valid: false, error: 'history must be an array' };
  }
  if (history.length > MAX_HISTORY_ITEMS) {
    return { valid: false, error: `history must contain at most ${MAX_HISTORY_ITEMS} items` };
  }
  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: `history[${i}] must be an object` };
    }
    if (!VALID_ROLES.has(item.role)) {
      return { valid: false, error: `history[${i}].role must be "user" or "assistant"` };
    }
    if (typeof item.content !== 'string') {
      return { valid: false, error: `history[${i}].content must be a string` };
    }
    if (item.content.length === 0) {
      return { valid: false, error: `history[${i}].content must not be empty` };
    }
    if (item.content.length > MAX_HISTORY_CONTENT) {
      return { valid: false, error: `history[${i}].content must be ${MAX_HISTORY_CONTENT} characters or fewer` };
    }
  }
  // Return a defensive shallow copy of the array with copies of each item
  return { valid: true, value: history.map((item) => ({ role: item.role, content: item.content })) };
}
