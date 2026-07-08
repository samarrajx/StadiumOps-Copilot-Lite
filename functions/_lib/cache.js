/**
 * @file cache.js
 * Simple TTL-based in-process cache backed by a caller-owned Map.
 *
 * DESIGN: Same as rateLimit.js — no module-level state here. The store Map
 * is owned by the calling Cloudflare Pages Function module. These are pure
 * functions of their arguments.
 *
 * makeCacheKey uses a djb2 hash, which is NON-CRYPTOGRAPHIC and is used
 * ONLY for deduplication of cache lookups — never for security purposes.
 */

// ---------------------------------------------------------------------------
// makeCacheKey
// ---------------------------------------------------------------------------

/**
 * djb2 hash — deterministic, non-cryptographic, for cache-key deduplication only.
 * NOT suitable for any security purpose.
 *
 * @param {string} str
 * @returns {string} Unsigned 32-bit integer as a base-36 string.
 */
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + charCode, kept as unsigned 32-bit
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Builds a deterministic cache key from a message and an array of language codes.
 * Language codes are sorted before hashing so order does not affect the key.
 *
 * @param {string}   message       - The broadcast message text.
 * @param {string[]} languageCodes - ISO 639-1 language codes (order-independent).
 * @returns {string}               - A short hash string suitable as a Map key.
 */
export function makeCacheKey(message, languageCodes) {
  const sortedCodes = Array.isArray(languageCodes)
    ? [...languageCodes].sort().join(',')
    : '';
  // ASSUMPTION: Pipe character is used as separator because it cannot appear
  // in a valid ISO 639-1 code and is unlikely to collide across fields.
  return djb2(`${message}|${sortedCodes}`);
}

// ---------------------------------------------------------------------------
// getCached
// ---------------------------------------------------------------------------

/**
 * Retrieves a cached value if it exists and has not exceeded its TTL.
 * Expired entries are evicted from the store on access.
 *
 * TTL check uses strict > so an entry at exactly TTL milliseconds old
 * is still considered fresh (expires at TTL + 1 ms).
 *
 * @param {Map}    store  - Caller-owned Map<string, {value, storedAt: number}>.
 * @param {string} key    - Cache key (from makeCacheKey).
 * @param {number} ttlMs  - Time-to-live in milliseconds.
 * @param {number} nowMs  - Current timestamp in milliseconds.
 * @returns {*|null}      - Cached value, or null on miss or expiry.
 */
export function getCached(store, key, ttlMs, nowMs) {
  const entry = store.get(key);
  if (entry == null) return null;
  if (nowMs - entry.storedAt > ttlMs) {
    store.delete(key); // evict expired entry eagerly
    return null;
  }
  return entry.value;
}

// ---------------------------------------------------------------------------
// setCached
// ---------------------------------------------------------------------------

/**
 * Stores a value in the cache with the current timestamp.
 *
 * @param {Map}    store  - Caller-owned Map<string, {value, storedAt: number}>.
 * @param {string} key    - Cache key (from makeCacheKey).
 * @param {*}      value  - Value to cache (any serialisable type).
 * @param {number} nowMs  - Current timestamp in milliseconds.
 * @returns {void}
 */
export function setCached(store, key, value, nowMs) {
  store.set(key, { value, storedAt: nowMs });
}
