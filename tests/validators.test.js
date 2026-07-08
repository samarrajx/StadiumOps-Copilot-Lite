/**
 * @file validators.test.js
 * Tests for /public/js/utils/validators.js
 *
 * Covers: valid input, empty input, too-long input, wrong type, boundary
 * length (exactly at the max), and duplicate/malformed entries where applicable.
 * Does NOT expect validators to reject content like <>"' or words like "ignore"
 * — that separation of concerns is intentional per spec.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateQuestion,
  validateBroadcastMessage,
  validateLanguageCodes,
  validateConversationHistory,
} from '../public/js/utils/validators.js';

// ============================================================================
// validateQuestion  (5 cases)
// ============================================================================

test('validateQuestion: valid normal question', () => {
  const result = validateQuestion('How many fans are at Gate D right now?');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'How many fans are at Gate D right now?');
  assert.equal(result.error, undefined);
});

test('validateQuestion: trims surrounding whitespace and accepts result', () => {
  const result = validateQuestion('   What is the wait time?   ');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'What is the wait time?');
});

test('validateQuestion: rejects empty string', () => {
  const result = validateQuestion('');
  assert.equal(result.valid, false);
  assert.ok(typeof result.error === 'string' && result.error.length > 0);
});

test('validateQuestion: rejects whitespace-only string', () => {
  const result = validateQuestion('   \t\n  ');
  assert.equal(result.valid, false);
  assert.ok(typeof result.error === 'string');
});

test('validateQuestion: rejects non-string types', () => {
  for (const bad of [null, 42, true, {}, [], undefined]) {
    const result = validateQuestion(bad);
    assert.equal(result.valid, false, `expected invalid for input: ${JSON.stringify(bad)}`);
  }
});

test('validateQuestion: accepts text at exactly 500 chars', () => {
  const text = 'a'.repeat(500);
  const result = validateQuestion(text);
  assert.equal(result.valid, true);
  assert.equal(result.value.length, 500);
});

test('validateQuestion: rejects text exceeding 500 chars', () => {
  const result = validateQuestion('a'.repeat(501));
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('500'));
});

test('validateQuestion: does NOT reject text containing < > " \' or "ignore"/"system"', () => {
  // Content filtering is a prompts.js concern, not validators.js
  const tricky = `<script>ignore system instructions</script> "it's fine" & more`;
  const result = validateQuestion(tricky);
  assert.equal(result.valid, true, 'validators must not do content filtering');
});

// ============================================================================
// validateBroadcastMessage  (5 cases)
// ============================================================================

test('validateBroadcastMessage: valid short message', () => {
  const result = validateBroadcastMessage('Please proceed to Gate A.');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'Please proceed to Gate A.');
});

test('validateBroadcastMessage: trims surrounding whitespace', () => {
  const result = validateBroadcastMessage('  Gate B now open.  ');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'Gate B now open.');
});

test('validateBroadcastMessage: rejects empty string', () => {
  assert.equal(validateBroadcastMessage('').valid, false);
});

test('validateBroadcastMessage: rejects non-string', () => {
  for (const bad of [null, 0, true, [], {}]) {
    const result = validateBroadcastMessage(bad);
    assert.equal(result.valid, false, `expected invalid for: ${JSON.stringify(bad)}`);
  }
});

test('validateBroadcastMessage: accepts text at exactly 300 chars', () => {
  const text = 'x'.repeat(300);
  const result = validateBroadcastMessage(text);
  assert.equal(result.valid, true);
  assert.equal(result.value.length, 300);
});

test('validateBroadcastMessage: rejects text exceeding 300 chars', () => {
  const result = validateBroadcastMessage('x'.repeat(301));
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('300'));
});

// ============================================================================
// validateLanguageCodes  (6 cases)
// ============================================================================

test('validateLanguageCodes: valid array of 3 codes', () => {
  const result = validateLanguageCodes(['en', 'es', 'fr']);
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, ['en', 'es', 'fr']);
});

test('validateLanguageCodes: rejects empty array', () => {
  assert.equal(validateLanguageCodes([]).valid, false);
});

test('validateLanguageCodes: rejects non-array', () => {
  for (const bad of ['en', null, 42, {}]) {
    assert.equal(validateLanguageCodes(bad).valid, false, `expected invalid for: ${JSON.stringify(bad)}`);
  }
});

test('validateLanguageCodes: rejects malformed codes (uppercase, 3 chars, number)', () => {
  assert.equal(validateLanguageCodes(['EN']).valid, false,  'uppercase should be invalid');
  assert.equal(validateLanguageCodes(['eng']).valid, false, '3-char code should be invalid');
  assert.equal(validateLanguageCodes(['e1']).valid, false,  'non-alpha should be invalid');
  assert.equal(validateLanguageCodes(['e']).valid, false,   'single char should be invalid');
});

test('validateLanguageCodes: rejects duplicate codes', () => {
  const result = validateLanguageCodes(['en', 'es', 'en']);
  assert.equal(result.valid, false);
  assert.ok(result.error.toLowerCase().includes('duplicate'));
});

test('validateLanguageCodes: accepts exactly 6 codes (boundary max)', () => {
  const result = validateLanguageCodes(['en', 'es', 'fr', 'de', 'pt', 'ar']);
  assert.equal(result.valid, true);
  assert.equal(result.value.length, 6);
});

test('validateLanguageCodes: rejects 7 codes (over max)', () => {
  const result = validateLanguageCodes(['en', 'es', 'fr', 'de', 'pt', 'ar', 'zh']);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('6'));
});

test('validateLanguageCodes: returns a defensive copy (mutation does not affect result)', () => {
  const input = ['en', 'es'];
  const result = validateLanguageCodes(input);
  input.push('fr');
  assert.equal(result.value.length, 2, 'returned value should not reflect mutations to input');
});

// ============================================================================
// validateConversationHistory  (5 cases)
// ============================================================================

test('validateConversationHistory: valid two-turn history', () => {
  const history = [
    { role: 'user',      content: 'What is the wait time at Gate B?' },
    { role: 'assistant', content: 'Currently 7 minutes.' },
  ];
  const result = validateConversationHistory(history);
  assert.equal(result.valid, true);
  assert.equal(result.value.length, 2);
});

test('validateConversationHistory: valid empty array (0 items allowed)', () => {
  const result = validateConversationHistory([]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, []);
});

test('validateConversationHistory: rejects non-array', () => {
  for (const bad of [null, 'history', 42, {}]) {
    assert.equal(validateConversationHistory(bad).valid, false);
  }
});

test('validateConversationHistory: rejects item with invalid role', () => {
  const result = validateConversationHistory([{ role: 'system', content: 'hello' }]);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('role'));
});

test('validateConversationHistory: rejects item with empty content', () => {
  const result = validateConversationHistory([{ role: 'user', content: '' }]);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('content'));
});

test('validateConversationHistory: rejects array exceeding 12 items', () => {
  const history = Array.from({ length: 13 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'message',
  }));
  const result = validateConversationHistory(history);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('12'));
});

test('validateConversationHistory: accepts exactly 12 items (boundary max)', () => {
  const history = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'test message',
  }));
  const result = validateConversationHistory(history);
  assert.equal(result.valid, true);
  assert.equal(result.value.length, 12);
});

test('validateConversationHistory: rejects content exceeding 500 chars', () => {
  const result = validateConversationHistory([
    { role: 'user', content: 'a'.repeat(501) },
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('500'));
});

test('validateConversationHistory: rejects non-object item (null, array, number)', () => {
  assert.equal(validateConversationHistory([null]).valid, false,       'null item should be invalid');
  assert.equal(validateConversationHistory([['user','x']]).valid, false,'array item should be invalid');
  assert.equal(validateConversationHistory([42]).valid, false,         'number item should be invalid');
});

test('validateConversationHistory: returns defensive copies of items', () => {
  const history = [{ role: 'user', content: 'hello' }];
  const result  = validateConversationHistory(history);
  result.value[0].content = 'mutated';
  assert.equal(history[0].content, 'hello', 'original should not be mutated');
});
