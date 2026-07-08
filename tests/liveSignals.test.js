/**
 * @file liveSignals.test.js
 * Tests for /public/js/liveSignals.js
 *
 * Coverage:
 *   - Determinism (same input → deep-equal output)
 *   - Correct matchStatus at every phase boundary
 *   - Gate C always wheelchairAccessible: false
 *   - Gates array length and ID stability across phases
 *   - waitTimeMinutes are non-negative integers
 *   - Density and trend values are valid
 *   - accessibilityRequests count stays 0–5 and varies with time
 *   - Transit array always has ≥ 3 entries
 *   - Gate densities increase during crush vs. quiet phases
 *   - Wait times increase during crush and egress vs. in-play
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLiveSignals, GATE_IDS } from '../public/js/liveSignals.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIN = 60_000;              // 1 minute in milliseconds
const S   = 1_700_000_000_000;  // arbitrary fixed match-start timestamp (ms)

/** Call generateLiveSignals with elapsed minutes relative to S. */
function signalAt(elapsedMin) {
  return generateLiveSignals(S + elapsedMin * MIN, S);
}

/** Return the density ordinal (0/1/2) for comparison in numeric tests. */
const DENSITY_ORDER = { low: 0, medium: 1, high: 2 };

// ---------------------------------------------------------------------------
// Test 1–3: Determinism
// ---------------------------------------------------------------------------

test('determinism: same inputs → deep-equal output (far pre-match, -90 min)', () => {
  const t = S - 90 * MIN;
  assert.deepEqual(generateLiveSignals(t, S), generateLiveSignals(t, S));
});

test('determinism: same inputs → deep-equal output (kickoff crush, +8 min)', () => {
  const t = S + 8 * MIN;
  assert.deepEqual(generateLiveSignals(t, S), generateLiveSignals(t, S));
});

test('determinism: same inputs → deep-equal output (egress, +100 min)', () => {
  const t = S + 100 * MIN;
  assert.deepEqual(generateLiveSignals(t, S), generateLiveSignals(t, S));
});

// ---------------------------------------------------------------------------
// Test 4–10: matchStatus at each phase boundary
// ---------------------------------------------------------------------------

test('matchStatus is "pre-match" well before kickoff (-90 min)', () => {
  assert.equal(signalAt(-90).match.matchStatus, 'pre-match');
});

test('matchStatus is "pre-match" just before kickoff (-1 min)', () => {
  assert.equal(signalAt(-1).match.matchStatus, 'pre-match');
});

test('matchStatus is "first-half" during kickoff crush (+5 min)', () => {
  assert.equal(signalAt(5).match.matchStatus, 'first-half');
});

test('matchStatus is "first-half" in normal first half (+30 min)', () => {
  assert.equal(signalAt(30).match.matchStatus, 'first-half');
});

test('matchStatus is "half-time" at +50 min', () => {
  assert.equal(signalAt(50).match.matchStatus, 'half-time');
});

test('matchStatus is "second-half" at +70 min', () => {
  assert.equal(signalAt(70).match.matchStatus, 'second-half');
});

test('matchStatus is "post-match" at the exact +90 min boundary', () => {
  // elapsed === 90 is NOT < 90, so it falls into EGRESS → "post-match"
  assert.equal(signalAt(90).match.matchStatus, 'post-match');
});

// ---------------------------------------------------------------------------
// Test 11: Gate C always wheelchairAccessible: false
// ---------------------------------------------------------------------------

test('gate C is wheelchairAccessible:false across all phases', () => {
  const testPoints = [-90, -30, -1, 5, 30, 50, 70, 100];
  for (const e of testPoints) {
    const gateC = signalAt(e).gates.find((g) => g.id === 'C');
    assert.ok(gateC, `gate C absent at elapsed ${e}`);
    assert.equal(
      gateC.wheelchairAccessible,
      false,
      `gate C must never be wheelchairAccessible (elapsed ${e})`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 12: Gates array length stability
// ---------------------------------------------------------------------------

test('gates array length always equals GATE_IDS.length across all phases', () => {
  for (const e of [-90, -30, 5, 30, 50, 70, 100]) {
    const { gates } = signalAt(e);
    assert.equal(
      gates.length,
      GATE_IDS.length,
      `unexpected gate count at elapsed ${e}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 13: Gates array IDs match GATE_IDS in order
// ---------------------------------------------------------------------------

test('gates array IDs match GATE_IDS in order across all phases', () => {
  for (const e of [-90, -30, 5, 30, 50, 70, 100]) {
    const ids = signalAt(e).gates.map((g) => g.id);
    assert.deepEqual(ids, GATE_IDS, `gate ID order mismatch at elapsed ${e}`);
  }
});

// ---------------------------------------------------------------------------
// Test 14: waitTimeMinutes are non-negative integers
// ---------------------------------------------------------------------------

test('all gate waitTimeMinutes are non-negative integers across phases', () => {
  for (const e of [-90, -30, 0, 5, 30, 50, 70, 100]) {
    for (const gate of signalAt(e).gates) {
      assert.ok(
        Number.isInteger(gate.waitTimeMinutes),
        `gate ${gate.id} waitTimeMinutes is not an integer at elapsed ${e}`,
      );
      assert.ok(
        gate.waitTimeMinutes >= 0,
        `gate ${gate.id} waitTimeMinutes is negative at elapsed ${e}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Test 15: Density values are from the allowed set
// ---------------------------------------------------------------------------

test('all gate densities are valid strings ("low"|"medium"|"high")', () => {
  const valid = new Set(['low', 'medium', 'high']);
  for (const e of [-90, -30, 5, 30, 50, 70, 100]) {
    for (const gate of signalAt(e).gates) {
      assert.ok(
        valid.has(gate.density),
        `invalid density "${gate.density}" for gate ${gate.id} at elapsed ${e}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Test 16: Trend values are from the allowed set
// ---------------------------------------------------------------------------

test('all gate trends are valid strings ("rising"|"falling"|"stable")', () => {
  const valid = new Set(['rising', 'falling', 'stable']);
  for (const e of [-90, -30, 5, 30, 50, 70, 100]) {
    for (const gate of signalAt(e).gates) {
      assert.ok(
        valid.has(gate.trend),
        `invalid trend "${gate.trend}" for gate ${gate.id} at elapsed ${e}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Test 17: accessibilityRequests count is always 0–5
// ---------------------------------------------------------------------------

test('accessibilityRequests count is always between 0 and 5', () => {
  for (const e of [-90, -30, 5, 30, 50, 70, 100]) {
    const { accessibilityRequests: reqs } = signalAt(e);
    assert.ok(
      reqs.length >= 0 && reqs.length <= 5,
      `request count ${reqs.length} out of range at elapsed ${e}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 18: accessibilityRequests count varies deterministically with time
// ---------------------------------------------------------------------------

test('accessibilityRequests count varies across phases (deterministic variation)', () => {
  // -90 min: no requests opened yet → 0
  // -25 min: AR-001 and AR-002 are open → 2
  // +5 min:  AR-001, AR-002, AR-003 all active → 3
  const countFarPre  = signalAt(-90).accessibilityRequests.length;
  const countNearPre = signalAt(-25).accessibilityRequests.length;
  const countCrush   = signalAt(5).accessibilityRequests.length;

  assert.equal(countFarPre,  0, 'no requests should be active at -90 min');
  assert.equal(countNearPre, 2, 'AR-001 and AR-002 should be active at -25 min');
  assert.equal(countCrush,   3, 'AR-001, AR-002, AR-003 should be active at +5 min');
});

// ---------------------------------------------------------------------------
// Test 19: Transit array always has at least 3 entries
// ---------------------------------------------------------------------------

test('transit array always has at least 3 entries across phases', () => {
  for (const e of [-90, -30, 5, 30, 50, 70, 100]) {
    const { transit } = signalAt(e);
    assert.ok(
      transit.length >= 3,
      `transit count ${transit.length} < 3 at elapsed ${e}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 20: Gate density is higher during crush than during quiet first half
// ---------------------------------------------------------------------------

test('gate density is >= during crush (+5 min) vs quiet first half (+30 min)', () => {
  const crush     = signalAt(5);
  const firstHalf = signalAt(30);
  for (let i = 0; i < GATE_IDS.length; i++) {
    const crushOrd = DENSITY_ORDER[crush.gates[i].density];
    const halfOrd  = DENSITY_ORDER[firstHalf.gates[i].density];
    assert.ok(
      crushOrd >= halfOrd,
      `gate ${GATE_IDS[i]}: crush density (${crush.gates[i].density}) should be >= first-half density (${firstHalf.gates[i].density})`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 21: Wait times higher during egress than during in-play phases
// ---------------------------------------------------------------------------

test('all gates have higher wait times during egress (+100 min) than second half (+70 min)', () => {
  const egress     = signalAt(100);
  const secondHalf = signalAt(70);
  for (let i = 0; i < GATE_IDS.length; i++) {
    assert.ok(
      egress.gates[i].waitTimeMinutes > secondHalf.gates[i].waitTimeMinutes,
      `gate ${GATE_IDS[i]}: egress wait (${egress.gates[i].waitTimeMinutes}) should exceed second-half wait (${secondHalf.gates[i].waitTimeMinutes})`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 22: All accessibility request fields have valid shapes
// ---------------------------------------------------------------------------

test('all active accessibilityRequest entries have valid field types and values', () => {
  const validTypes   = new Set(['wheelchair', 'sign-language', 'visual', 'sensory']);
  const validStatus  = new Set(['open', 'dispatched']);

  // Test at +5 min where we expect 3 requests
  const { accessibilityRequests } = signalAt(5);
  for (const req of accessibilityRequests) {
    assert.ok(typeof req.id         === 'string' && req.id.length > 0,  `id invalid: ${req.id}`);
    assert.ok(validTypes.has(req.type),                                  `type invalid: ${req.type}`);
    assert.ok(typeof req.gateId     === 'string' && GATE_IDS.includes(req.gateId), `gateId invalid: ${req.gateId}`);
    assert.ok(Number.isInteger(req.minutesOpen) && req.minutesOpen >= 0, `minutesOpen invalid: ${req.minutesOpen}`);
    assert.ok(validStatus.has(req.status),                               `status invalid: ${req.status}`);
    assert.ok(typeof req.note       === 'string' && req.note.length > 0, `note invalid: ${req.note}`);
  }
});
