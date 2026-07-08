/**
 * @file rateLimit.js
 * Pure sliding-window rate limiter and client-key extractor.
 *
 * DESIGN: This module holds NO module-level state. The `store` (a Map) is
 * owned by the calling function (a Cloudflare Pages Function module, which
 * may share a warm isolate). Passing the store in as an argument makes this
 * module fully pure and testable without any module-level side effects.
 */

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

/**
 * Checks whether a request from `key` is within the allowed rate.
 * Uses a sliding window: timestamps older than `windowMs` are pruned first.
 *
 * @param {Map}    store       - Caller-owned Map<string, number[]> (timestamps).
 * @param {string} key         - Client identifier (e.g. IP address).
 * @param {number} maxRequests - Maximum allowed requests per window.
 * @param {number} windowMs    - Window duration in milliseconds.
 * @param {number} nowMs       - Current timestamp in milliseconds.
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
export function checkRateLimit(store, key, maxRequests, windowMs, nowMs) {
  const existing = store.get(key) ?? [];
  const cutoff   = nowMs - windowMs;

  // Prune timestamps that have fallen outside the sliding window.
  // Uses strict > so a timestamp exactly at the cutoff boundary is pruned.
  const withinWindow = existing.filter((ts) => ts > cutoff);

  if (withinWindow.length < maxRequests) {
    // Within limit — record this request and allow it.
    withinWindow.push(nowMs);
    store.set(key, withinWindow);
    return { allowed: true, retryAfterMs: 0 };
  }

  // Over limit — compute how long until the oldest entry exits the window.
  // withinWindow is in insertion order (ascending), so [0] is the oldest.
  const oldest      = withinWindow[0];
  const retryAfterMs = (oldest + windowMs) - nowMs;

  // Update store with pruned list (don't record this rejected request).
  store.set(key, withinWindow);
  return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
}

// ---------------------------------------------------------------------------
// getClientKey
// ---------------------------------------------------------------------------

/**
 * Extracts a stable client identifier from a headers-like object.
 * Reads "cf-connecting-ip" first (Cloudflare's real-IP header),
 * then "x-forwarded-for", then falls back to "unknown".
 *
 * @param {{ get(name: string): string|null|undefined }|null|undefined} headersLike
 * @returns {string}
 */
export function getClientKey(headersLike) {
  return (
    headersLike?.get?.('cf-connecting-ip') ||
    headersLike?.get?.('x-forwarded-for')  ||
    'unknown'
  );
}
