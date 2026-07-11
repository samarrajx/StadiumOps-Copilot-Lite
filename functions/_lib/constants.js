/**
 * @file constants.js
 * Shared configuration constants for all Cloudflare Pages Function handlers.
 *
 * All values are pure numbers — no logic. Import the symbol you need rather
 * than hardcoding the literal, so a single edit here propagates everywhere.
 */

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/** Maximum number of API requests allowed per client per sliding window. */
export const RATE_LIMIT_MAX_REQUESTS = 20;

/** Sliding-window duration for rate limiting, in milliseconds (1 minute). */
export const RATE_LIMIT_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Broadcast translation cache
// ---------------------------------------------------------------------------

/** How long a cached broadcast translation is considered fresh (5 minutes). */
export const BROADCAST_CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Match timing (demo / prototype)
// ---------------------------------------------------------------------------

/** Offset subtracted from now to derive demo match-start time (30 minutes). */
export const MATCH_START_OFFSET_MS = 30 * 60 * 1000;
