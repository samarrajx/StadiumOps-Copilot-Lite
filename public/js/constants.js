/**
 * @file constants.js
 * Shared configuration constants for the StadiumOps Copilot frontend.
 *
 * All values are pure numbers — no logic. Import the symbol you need rather
 * than hardcoding the literal, so a single edit here propagates everywhere.
 */

// ---------------------------------------------------------------------------
// Live signals
// ---------------------------------------------------------------------------

/** How often (in ms) the live-signals generator is polled to refresh the store. */
export const SIGNALS_REFRESH_INTERVAL_MS = 8_000;

// ---------------------------------------------------------------------------
// Match timing (demo / prototype)
// ---------------------------------------------------------------------------

/** Offset added to Date.now() to derive the demo match-start time (30 minutes ahead). */
export const MATCH_START_OFFSET_MS = 30 * 60 * 1000;
