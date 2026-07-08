/**
 * @file prompts.test.js
 * Tests for /functions/_lib/prompts.js
 *
 * Key invariants checked:
 *  - renderContextSummary includes every gate id and wheelchair flag
 *  - Every build*Prompt that handles user text includes an "untrusted" label
 *  - buildBriefingPrompt has zero user-text injection surface (no free-text param)
 *  - JSON-only instruction is present in broadcast and accessibility prompts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderContextSummary,
  DECISION_ASSISTANT_SYSTEM_PROMPT,
  buildAssistantPrompt,
  buildBriefingPrompt,
  buildBroadcastPrompt,
  buildAccessibilityPrompt,
} from '../functions/_lib/prompts.js';

// ---------------------------------------------------------------------------
// Shared fixture — a minimal but complete LiveSignals object
// ---------------------------------------------------------------------------
const SAMPLE_SIGNALS = {
  match: {
    homeTeam:         'USA',
    awayTeam:         'Mexico',
    competitionStage: 'Group Stage — Matchday 2',
    venue:            'MetLife Stadium',
    city:             'East Rutherford, NJ',
    matchStatus:      'first-half',
  },
  weather: {
    condition:   'Partly Cloudy',
    tempCelsius: 23,
    advisory:    'Peak UV — remind outdoor staff.',
  },
  gates: [
    { id: 'A', zone: 'North',      density: 'high',   waitTimeMinutes: 21, trend: 'falling', wheelchairAccessible: true  },
    { id: 'B', zone: 'North-East', density: 'high',   waitTimeMinutes: 15, trend: 'falling', wheelchairAccessible: true  },
    { id: 'C', zone: 'East',       density: 'high',   waitTimeMinutes: 18, trend: 'falling', wheelchairAccessible: false },
    { id: 'D', zone: 'South',      density: 'high',   waitTimeMinutes: 25, trend: 'falling', wheelchairAccessible: true  },
    { id: 'E', zone: 'South-West', density: 'medium', waitTimeMinutes: 12, trend: 'falling', wheelchairAccessible: true  },
    { id: 'F', zone: 'West',       density: 'high',   waitTimeMinutes: 17, trend: 'falling', wheelchairAccessible: true  },
  ],
  transit: [
    { name: 'NJ Transit — Meadowlands Line', mode: 'rail',    state: 'disrupted', etaMinutes: 23 },
    { name: 'Shuttle — Lot A Express',        mode: 'shuttle', state: 'delayed',   etaMinutes: 12 },
    { name: 'NJ Transit Bus 351',             mode: 'bus',     state: 'on-time',   etaMinutes:  9 },
  ],
  accessibilityRequests: [
    { id: 'AR-001', type: 'wheelchair',   gateId: 'D', minutesOpen: 55, status: 'dispatched', note: 'Fan needs escort.' },
    { id: 'AR-002', type: 'sign-language',gateId: 'A', minutesOpen: 40, status: 'dispatched', note: 'BSL needed.'       },
  ],
};

const NO_REQ_SIGNALS = { ...SAMPLE_SIGNALS, accessibilityRequests: [] };

// ============================================================================
// renderContextSummary
// ============================================================================

test('renderContextSummary: includes every gate id from the signals', () => {
  const summary = renderContextSummary(SAMPLE_SIGNALS);
  for (const gate of SAMPLE_SIGNALS.gates) {
    assert.ok(
      summary.includes(`Gate ${gate.id}`),
      `expected "Gate ${gate.id}" in context summary`,
    );
  }
});

test('renderContextSummary: wheelchair=YES for accessible gates, NO for Gate C', () => {
  const summary = renderContextSummary(SAMPLE_SIGNALS);
  // Gate C is the fixed non-accessible gate — must show NO
  assert.ok(summary.includes('Gate C'), 'Gate C must be present');
  // Find the Gate C line and confirm wheelchair=NO
  const cLine = summary.split('\n').find((l) => l.includes('Gate C'));
  assert.ok(cLine, 'Gate C line not found');
  assert.ok(cLine.includes('wheelchair=NO'), `Gate C line should contain wheelchair=NO, got: "${cLine}"`);
  // Spot-check Gate A for YES
  const aLine = summary.split('\n').find((l) => l.includes('Gate A'));
  assert.ok(aLine.includes('wheelchair=YES'), `Gate A line should contain wheelchair=YES, got: "${aLine}"`);
});

test('renderContextSummary: includes all transit entries by mode', () => {
  const summary = renderContextSummary(SAMPLE_SIGNALS);
  for (const t of SAMPLE_SIGNALS.transit) {
    assert.ok(
      summary.includes(t.mode),
      `expected transit mode "${t.mode}" in context summary`,
    );
    assert.ok(
      summary.includes(String(t.etaMinutes)),
      `expected ETA "${t.etaMinutes}" in context summary`,
    );
  }
});

test('renderContextSummary: shows "none" when accessibilityRequests is empty', () => {
  const summary = renderContextSummary(NO_REQ_SIGNALS);
  assert.ok(summary.includes('none'), 'expected "none" for empty accessibility requests');
});

test('renderContextSummary: includes open accessibility request ids when present', () => {
  const summary = renderContextSummary(SAMPLE_SIGNALS);
  assert.ok(summary.includes('AR-001'), 'expected AR-001 in summary');
  assert.ok(summary.includes('AR-002'), 'expected AR-002 in summary');
});

// ============================================================================
// DECISION_ASSISTANT_SYSTEM_PROMPT
// ============================================================================

test('DECISION_ASSISTANT_SYSTEM_PROMPT: mentions "untrusted" and role-change protection', () => {
  const p = DECISION_ASSISTANT_SYSTEM_PROMPT;
  assert.ok(p.toLowerCase().includes('untrusted'),
    'system prompt must reference untrusted input');
  // Must warn about manipulation/role-change attempts
  const hasRoleChangeWarning =
    p.toLowerCase().includes('role') &&
    (p.toLowerCase().includes('ignore') || p.toLowerCase().includes('silently'));
  assert.ok(hasRoleChangeWarning,
    'system prompt must instruct model to ignore role-change attempts');
});

// ============================================================================
// buildAssistantPrompt
// ============================================================================

test('buildAssistantPrompt: wraps question with "untrusted" label', () => {
  const question = 'Should I close Gate D?';
  const prompt = buildAssistantPrompt(SAMPLE_SIGNALS, question, []);
  assert.ok(
    prompt.toLowerCase().includes('untrusted'),
    'prompt must label organizer question as untrusted',
  );
  // The question text must appear (as data), not be omitted
  assert.ok(
    prompt.includes(question),
    'question text must appear in the prompt',
  );
});

test('buildAssistantPrompt: includes conversation history entries when provided', () => {
  const history = [
    { role: 'user',      content: 'What is the wait at Gate A?' },
    { role: 'assistant', content: 'Currently 21 minutes, trending down.' },
  ];
  const prompt = buildAssistantPrompt(SAMPLE_SIGNALS, 'Follow-up?', history);
  assert.ok(prompt.includes(history[0].content), 'user history content must appear');
  assert.ok(prompt.includes(history[1].content), 'assistant history content must appear');
});

test('buildAssistantPrompt: omits history section when history is empty', () => {
  const prompt = buildAssistantPrompt(SAMPLE_SIGNALS, 'Any issues?', []);
  assert.ok(!prompt.includes('CONVERSATION HISTORY'), 'history section should not appear for empty history');
});

// ============================================================================
// buildBriefingPrompt
// ============================================================================

test('buildBriefingPrompt: returns a non-empty string containing context markers', () => {
  const prompt = buildBriefingPrompt(SAMPLE_SIGNALS);
  assert.ok(typeof prompt === 'string' && prompt.length > 0, 'must return non-empty string');
  // Context summary must be embedded
  assert.ok(prompt.includes('=== LIVE OPERATIONAL CONTEXT ==='),
    'briefing prompt must include context summary header');
  // Must include instruction (3-5 sentences requirement)
  assert.ok(prompt.includes('3-5') || prompt.includes('3–5'),
    'briefing prompt must reference the 3-5 sentence requirement');
});

test('buildBriefingPrompt: function accepts exactly one argument (no user-text parameter)', () => {
  // The function signature is buildBriefingPrompt(signals) — zero injection surface.
  // Verify it runs without a second arg and does not accept free-form text.
  assert.equal(buildBriefingPrompt.length, 1,
    'buildBriefingPrompt must have exactly 1 parameter (signals only — no user text)');
});

// ============================================================================
// buildBroadcastPrompt
// ============================================================================

test('buildBroadcastPrompt: wraps message as untrusted and includes JSON-only instruction', () => {
  const msg = 'Gate A is now open for boarding.';
  const prompt = buildBroadcastPrompt(msg, ['es', 'fr']);
  // Untrusted label
  assert.ok(prompt.toLowerCase().includes('untrusted'),
    'broadcast prompt must label operator message as untrusted');
  // Message must appear as data
  assert.ok(prompt.includes(msg), 'operator message must appear in prompt');
  // JSON-only instruction
  assert.ok(
    prompt.toLowerCase().includes('only valid json') ||
    prompt.toLowerCase().includes('only json'),
    'broadcast prompt must instruct model to return JSON only',
  );
  // Must include language codes
  assert.ok(prompt.includes('es') && prompt.includes('fr'),
    'broadcast prompt must include the requested language codes');
});

test('buildBroadcastPrompt: specifies the "translations" + "plainLanguage" JSON shape', () => {
  const prompt = buildBroadcastPrompt('Test message.', ['de']);
  assert.ok(prompt.includes('"translations"'), 'must reference "translations" key');
  assert.ok(prompt.includes('"plainLanguage"'), 'must reference "plainLanguage" key');
});

// ============================================================================
// buildAccessibilityPrompt
// ============================================================================

test('buildAccessibilityPrompt: includes JSON-only instruction and "ranked" shape', () => {
  const prompt = buildAccessibilityPrompt(SAMPLE_SIGNALS.accessibilityRequests);
  assert.ok(
    prompt.toLowerCase().includes('only valid json') ||
    prompt.toLowerCase().includes('only json'),
    'accessibility prompt must instruct model to return JSON only',
  );
  assert.ok(prompt.includes('"ranked"'), 'must reference "ranked" key');
  assert.ok(prompt.includes('"urgencyRank"'), 'must reference "urgencyRank" key');
});

test('buildAccessibilityPrompt: contains every input request id', () => {
  const requests = SAMPLE_SIGNALS.accessibilityRequests;
  const prompt = buildAccessibilityPrompt(requests);
  for (const req of requests) {
    assert.ok(
      prompt.includes(req.id),
      `expected request id "${req.id}" in accessibility prompt`,
    );
  }
});

test('buildAccessibilityPrompt: warns model not to invent new ids', () => {
  const prompt = buildAccessibilityPrompt(SAMPLE_SIGNALS.accessibilityRequests);
  assert.ok(
    prompt.toLowerCase().includes('do not invent') ||
    prompt.toLowerCase().includes('only the request ids'),
    'prompt must instruct model not to invent new request ids',
  );
});
