/**
 * @file formatters.js
 * Pure formatting utilities for display strings.
 * All functions are null/undefined/NaN-safe — they never throw,
 * returning "—" (em-dash) as the fallback sentinel for bad inputs.
 */

// ---------------------------------------------------------------------------
// formatWaitTime
// ---------------------------------------------------------------------------

/**
 * Formats a gate queue wait time for display.
 *
 * @param {unknown} minutes - Wait time in whole minutes.
 * @returns {string} e.g. "1 min", "7 min", or "—" for bad input.
 */
export function formatWaitTime(minutes) {
  if (minutes == null || typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    return '—';
  }
  const m = Math.round(minutes);
  return m === 1 ? '1 min' : `${m} min`;
}

// ---------------------------------------------------------------------------
// formatSeverityLabel
// ---------------------------------------------------------------------------

// ASSUMPTION: Only three density levels are used ("low" / "medium" / "high"),
// matching the values produced by liveSignals.js. Any other string returns "—".
const SEVERITY_MAP = Object.freeze({ low: 'Low', medium: 'Moderate', high: 'High' });

/**
 * Maps a gate density string to a human-readable severity label.
 *
 * @param {unknown} density - "low" | "medium" | "high"
 * @returns {string} "Low" | "Moderate" | "High" | "—"
 */
export function formatSeverityLabel(density) {
  return SEVERITY_MAP[density] ?? '—';
}

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

/**
 * Returns a short human-readable relative time string.
 *
 * @param {unknown} timestampMs - The past timestamp in milliseconds.
 * @param {unknown} nowMs       - The current timestamp in milliseconds.
 * @returns {string} e.g. "just now", "3m ago", "2h ago", or "—".
 */
export function formatRelativeTime(timestampMs, nowMs) {
  if (
    timestampMs == null || nowMs == null ||
    typeof timestampMs !== 'number' || typeof nowMs !== 'number' ||
    !Number.isFinite(timestampMs) || !Number.isFinite(nowMs)
  ) {
    return '—';
  }
  const diffSec = Math.floor((nowMs - timestampMs) / 1000);
  if (diffSec < 0)  return 'just now'; // clamp future timestamps gracefully
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}
