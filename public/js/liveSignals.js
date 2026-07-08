/**
 * @file liveSignals.js
 * Pure deterministic simulator of matchday live operational state.
 *
 * All output is a pure function of (timestampMs - matchStartMs).
 * No Math.random(), no Date.now() side-effects — calling this function twice
 * with the same arguments always returns deep-equal output.
 *
 * Internal phases (not exported):
 *   0 FAR_PRE    elapsed < -60 min
 *   1 NEAR_PRE   -60 <= elapsed < 0 min
 *   2 CRUSH      0 <= elapsed < 15 min  (kickoff crush)
 *   3 FIRST_HALF 15 <= elapsed < 45 min
 *   4 HALF_TIME  45 <= elapsed < 60 min
 *   5 SECOND_HALF 60 <= elapsed < 90 min
 *   6 EGRESS     elapsed >= 90 min
 */

// ---------------------------------------------------------------------------
// Public: fixed gate ID list (gate "C" is always included — fixed scenario)
// ---------------------------------------------------------------------------

/** Fixed ordered list of gate IDs used throughout the application. */
export const GATE_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ---------------------------------------------------------------------------
// Static match metadata
// ---------------------------------------------------------------------------
// ASSUMPTION: Match is USA vs Mexico at MetLife Stadium, Group Stage Matchday 2.
// A real deployment would inject this from a schedule API; here it is fixed for demo.
const MATCH_INFO = {
  homeTeam:         'USA',
  awayTeam:         'Mexico',
  competitionStage: 'Group Stage — Matchday 2',
  venue:            'MetLife Stadium',
  city:             'East Rutherford, NJ',
};

// ---------------------------------------------------------------------------
// Static gate metadata
// ---------------------------------------------------------------------------
// ASSUMPTION: wheelchairAccessible is a static, per-gate venue property.
// Gate C is intentionally non-accessible — fixed scenario detail that every
// downstream AI feature must reason about (e.g. re-routing wheelchair users).
const GATE_META = [
  { id: 'A', label: 'Gate A — North Stand',       zone: 'North',      wheelchairAccessible: true  },
  { id: 'B', label: 'Gate B — North-East Corner', zone: 'North-East', wheelchairAccessible: true  },
  { id: 'C', label: 'Gate C — East Stand',         zone: 'East',       wheelchairAccessible: false }, // Fixed scenario: Gate C lacks accessible ramp
  { id: 'D', label: 'Gate D — South Stand',        zone: 'South',      wheelchairAccessible: true  },
  { id: 'E', label: 'Gate E — South-West Corner', zone: 'South-West', wheelchairAccessible: true  },
  { id: 'F', label: 'Gate F — West Stand',         zone: 'West',       wheelchairAccessible: true  },
];

// ---------------------------------------------------------------------------
// Phase computation
// ---------------------------------------------------------------------------

const PHASE_FAR_PRE    = 0;
const PHASE_NEAR_PRE   = 1;
const PHASE_CRUSH      = 2;
const PHASE_FIRST_HALF = 3;
const PHASE_HALF_TIME  = 4;
const PHASE_SECOND_HALF = 5;
const PHASE_EGRESS     = 6;

/** matchStatus string for each internal phase index. */
const STATUS_BY_PHASE = [
  'pre-match',   // 0 FAR_PRE
  'pre-match',   // 1 NEAR_PRE
  'first-half',  // 2 CRUSH
  'first-half',  // 3 FIRST_HALF
  'half-time',   // 4 HALF_TIME
  'second-half', // 5 SECOND_HALF
  'post-match',  // 6 EGRESS
];

/** Derive internal phase code from elapsed minutes (pure function). */
function getPhase(elapsedMin) {
  if (elapsedMin <  -60) return PHASE_FAR_PRE;
  if (elapsedMin <    0) return PHASE_NEAR_PRE;
  if (elapsedMin <   15) return PHASE_CRUSH;
  if (elapsedMin <   45) return PHASE_FIRST_HALF;
  if (elapsedMin <   60) return PHASE_HALF_TIME;
  if (elapsedMin <   90) return PHASE_SECOND_HALF;
  return PHASE_EGRESS;
}

// ---------------------------------------------------------------------------
// Gate density + wait-time lookup tables
// Rows = phase (0–6). Columns = gate index matching GATE_IDS [A,B,C,D,E,F].
// ---------------------------------------------------------------------------

// 0 = low, 1 = medium, 2 = high
const PHASE_DENSITY = [
  // A  B  C  D  E  F
  [  0, 0, 0, 0, 0, 0 ],  // FAR_PRE    — light early arrivals
  [  1, 1, 1, 1, 1, 1 ],  // NEAR_PRE   — steady stream
  [  2, 2, 2, 2, 1, 2 ],  // CRUSH      — Gate E (smaller zone) slightly lower
  [  0, 0, 0, 0, 0, 0 ],  // FIRST_HALF — crowd inside, gates nearly empty
  [  1, 1, 1, 1, 0, 1 ],  // HALF_TIME  — re-entry/concessions rush
  [  0, 0, 0, 0, 0, 0 ],  // SECOND_HALF — quiet
  [  2, 2, 2, 2, 2, 2 ],  // EGRESS     — post-match surge
];

// Wait times in whole minutes per phase per gate.
// Gate D (South Stand) is the main tunnel → consistently longest queues.
const PHASE_WAIT = [
  //  A   B   C   D   E   F
  [   3,  2,  2,  4,  1,  2 ],  // FAR_PRE
  [  11,  8,  9, 13,  6,  8 ],  // NEAR_PRE
  [  21, 15, 18, 25, 12, 17 ],  // CRUSH
  [   2,  1,  1,  2,  1,  1 ],  // FIRST_HALF
  [   9,  7,  8, 11,  5,  7 ],  // HALF_TIME
  [   2,  1,  1,  3,  1,  2 ],  // SECOND_HALF
  [  27, 20, 23, 31, 16, 22 ],  // EGRESS
];

const DENSITY_LABELS = ['low', 'medium', 'high'];

/** Return wait-time minutes for a gate at an arbitrary elapsed time (pure). */
function waitAtElapsed(elapsedMin, gateIdx) {
  return PHASE_WAIT[getPhase(elapsedMin)][gateIdx];
}

/**
 * Compute queue trend by comparing wait now vs. 5 min from now.
 * Purely deterministic — no randomness.
 */
function computeTrend(elapsedMin, gateIdx) {
  const now  = waitAtElapsed(elapsedMin,     gateIdx);
  const soon = waitAtElapsed(elapsedMin + 5, gateIdx);
  if (soon > now + 2) return 'rising';
  if (soon < now - 2) return 'falling';
  return 'stable';
}

// ---------------------------------------------------------------------------
// Weather by phase
// ---------------------------------------------------------------------------
// ASSUMPTION: Weather is a fixed per-phase simulation. A production build
// would pull from a live weather API keyed on venue coordinates.
const WEATHER_BY_PHASE = [
  { condition: 'Partly Cloudy', tempCelsius: 25, advisory: null },
  { condition: 'Partly Cloudy', tempCelsius: 24, advisory: 'Crowds building — consider opening auxiliary gates early.' },
  { condition: 'Partly Cloudy', tempCelsius: 23, advisory: 'Peak UV index — remind outdoor staff to apply sunscreen.' },
  { condition: 'Clear',         tempCelsius: 22, advisory: null },
  { condition: 'Clear',         tempCelsius: 21, advisory: null },
  { condition: 'Clear',         tempCelsius: 19, advisory: null },
  { condition: 'Clear',         tempCelsius: 17, advisory: 'Evening cool-down — activate warming stations at Gate D and Gate F.' },
];

// ---------------------------------------------------------------------------
// Transit by phase
// ---------------------------------------------------------------------------
// ASSUMPTION: Transit service state (on-time/delayed/disrupted) is modelled
// as fixed per phase. Production would poll real transit feeds (e.g. GTFS-RT).
const TRANSIT_BY_PHASE = [
  // FAR_PRE — normal service
  [
    { name: 'NJ Transit — Meadowlands Line', mode: 'rail',    state: 'on-time',   etaMinutes:  8 },
    { name: 'Shuttle — Lot A Express',        mode: 'shuttle', state: 'on-time',   etaMinutes:  6 },
    { name: 'NJ Transit Bus 351',             mode: 'bus',     state: 'on-time',   etaMinutes: 14 },
  ],
  // NEAR_PRE — high load, minor rail delay
  [
    { name: 'NJ Transit — Meadowlands Line', mode: 'rail',    state: 'delayed',   etaMinutes: 15 },
    { name: 'Shuttle — Lot A Express',        mode: 'shuttle', state: 'on-time',   etaMinutes:  5 },
    { name: 'NJ Transit Bus 351',             mode: 'bus',     state: 'on-time',   etaMinutes: 11 },
  ],
  // CRUSH — surge, rail disrupted
  [
    { name: 'NJ Transit — Meadowlands Line', mode: 'rail',    state: 'disrupted', etaMinutes: 23 },
    { name: 'Shuttle — Lot A Express',        mode: 'shuttle', state: 'delayed',   etaMinutes: 12 },
    { name: 'NJ Transit Bus 351',             mode: 'bus',     state: 'on-time',   etaMinutes:  9 },
  ],
  // FIRST_HALF — quiet, services recover
  [
    { name: 'NJ Transit — Meadowlands Line', mode: 'rail',    state: 'on-time',   etaMinutes:  5 },
    { name: 'Shuttle — Lot A Express',        mode: 'shuttle', state: 'on-time',   etaMinutes:  4 },
    { name: 'NJ Transit Bus 351',             mode: 'bus',     state: 'on-time',   etaMinutes:  8 },
  ],
  // HALF_TIME
  [
    { name: 'NJ Transit — Meadowlands Line', mode: 'rail',    state: 'on-time',   etaMinutes:  6 },
    { name: 'Shuttle — Lot A Express',        mode: 'shuttle', state: 'on-time',   etaMinutes:  5 },
    { name: 'NJ Transit Bus 351',             mode: 'bus',     state: 'on-time',   etaMinutes: 10 },
  ],
  // SECOND_HALF
  [
    { name: 'NJ Transit — Meadowlands Line', mode: 'rail',    state: 'on-time',   etaMinutes:  5 },
    { name: 'Shuttle — Lot A Express',        mode: 'shuttle', state: 'on-time',   etaMinutes:  4 },
    { name: 'NJ Transit Bus 351',             mode: 'bus',     state: 'on-time',   etaMinutes:  7 },
  ],
  // EGRESS — second surge
  [
    { name: 'NJ Transit — Meadowlands Line', mode: 'rail',    state: 'delayed',   etaMinutes: 19 },
    { name: 'Shuttle — Lot A Express',        mode: 'shuttle', state: 'disrupted', etaMinutes: 26 },
    { name: 'NJ Transit Bus 351',             mode: 'bus',     state: 'delayed',   etaMinutes: 16 },
  ],
];

// ---------------------------------------------------------------------------
// Accessibility request pool
// ---------------------------------------------------------------------------
// Each entry is a scenario-fixed request with:
//   openedAtMin   — elapsed minutes when the request becomes active
//   resolvedAtMin — elapsed minutes when it closes (null = never auto-closes)
//   statusFn(e)   — pure function of elapsed minutes → 'open'|'dispatched'
//
// At any moment, active requests = those where openedAtMin <= elapsedMin
// AND (resolvedAtMin === null OR elapsedMin < resolvedAtMin).
// minutesOpen = Math.floor(elapsedMin - openedAtMin)  (always >= 0 by filter).
//
// ASSUMPTION: These are scenario-fixed requests for demo. A production system
// would pull live requests from a ticketing/CRM integration.
const REQUEST_POOL = [
  {
    id: 'AR-001', type: 'wheelchair', gateId: 'D',
    openedAtMin: -50, resolvedAtMin: 15,
    statusFn: (e) => (e < -30 ? 'open' : 'dispatched'),
    note: 'Fan requires powered wheelchair escort from Gate D to Section 114.',
  },
  {
    id: 'AR-002', type: 'sign-language', gateId: 'A',
    openedAtMin: -35, resolvedAtMin: null,
    statusFn: (e) => (e < -20 ? 'open' : 'dispatched'),
    note: 'BSL interpreter requested at Gate A information desk for group of 4.',
  },
  {
    id: 'AR-003', type: 'sensory', gateId: 'B',
    openedAtMin: -15, resolvedAtMin: 30,
    statusFn: (e) => (e < 0 ? 'open' : 'dispatched'),
    note: 'Sensory room access pre-check requested — North-East corridor.',
  },
  {
    id: 'AR-004', type: 'visual', gateId: 'F',
    openedAtMin: 42, resolvedAtMin: null,
    statusFn: (e) => (e < 48 ? 'open' : 'dispatched'),
    note: 'Sighted guide assistance for partially sighted fan group at Gate F.',
  },
  {
    id: 'AR-005', type: 'wheelchair', gateId: 'E',
    openedAtMin: 87, resolvedAtMin: null,
    statusFn: () => 'open',
    note: 'Wheelchair taxi requested at Gate E for post-match departure.',
  },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generates a complete snapshot of live operational signals for a given moment.
 *
 * Pure function — same (timestampMs, matchStartMs) always returns deep-equal output.
 *
 * @param {number} timestampMs  - Current Unix timestamp in milliseconds.
 * @param {number} matchStartMs - Match kick-off Unix timestamp in milliseconds.
 * @returns {object}            - LiveSignals plain object.
 */
export function generateLiveSignals(timestampMs, matchStartMs) {
  const elapsedMin = (timestampMs - matchStartMs) / 60_000;
  const phase = getPhase(elapsedMin);

  const match = {
    homeTeam:         MATCH_INFO.homeTeam,
    awayTeam:         MATCH_INFO.awayTeam,
    competitionStage: MATCH_INFO.competitionStage,
    venue:            MATCH_INFO.venue,
    city:             MATCH_INFO.city,
    matchStatus:      STATUS_BY_PHASE[phase],
  };

  // Shallow-copy so callers cannot mutate internal state
  const weather = { ...WEATHER_BY_PHASE[phase] };

  const gates = GATE_META.map((meta, idx) => ({
    id:                   meta.id,
    label:                meta.label,
    zone:                 meta.zone,
    density:              DENSITY_LABELS[PHASE_DENSITY[phase][idx]],
    waitTimeMinutes:      PHASE_WAIT[phase][idx],   // pre-defined integers
    trend:                computeTrend(elapsedMin, idx),
    wheelchairAccessible: meta.wheelchairAccessible,
  }));

  const transit = TRANSIT_BY_PHASE[phase].map((t) => ({ ...t }));

  const accessibilityRequests = REQUEST_POOL
    .filter((r) =>
      elapsedMin >= r.openedAtMin &&
      (r.resolvedAtMin === null || elapsedMin < r.resolvedAtMin),
    )
    .map((r) => ({
      id:          r.id,
      type:        r.type,
      gateId:      r.gateId,
      minutesOpen: Math.floor(elapsedMin - r.openedAtMin),
      status:      r.statusFn(elapsedMin),
      note:        r.note,
    }));

  return { match, weather, gates, transit, accessibilityRequests };
}
