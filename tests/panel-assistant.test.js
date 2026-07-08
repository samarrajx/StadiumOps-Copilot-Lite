/**
 * @file panel-assistant.test.js
 * Tests for /public/js/panels/assistant.js using JSDOM.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Setup jsdom environment for this module
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="container"></div></body></html>`);
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { renderAssistantPanel, mountAssistantPanel } = await import('../public/js/panels/assistant.js');

function getContainer() {
  const c = document.getElementById('container');
  c.innerHTML = '';
  return c;
}

// ---------------------------------------------------------------------------

test('assistant panel: initial render shows empty state and input', () => {
  const container = getContainer();
  renderAssistantPanel(container, { history: [], input: '', loading: false, error: null });
  
  const emptyState = container.querySelector('.empty-state');
  assert.ok(emptyState, 'Empty state text should be visible');
  
  const input = container.querySelector('input');
  assert.ok(input, 'Input element should exist');
  assert.equal(input.disabled, false);
});

test('assistant panel: renders history with screen-reader labels', () => {
  const container = getContainer();
  renderAssistantPanel(container, {
    history: [
      { role: 'user', content: 'Is Gate A open?' },
      { role: 'assistant', content: 'Yes.' }
    ],
    input: '', loading: false, error: null
  });
  
  const userMsg = container.querySelector('.chat-msg--user');
  assert.ok(userMsg);
  assert.ok(userMsg.textContent.includes('You:'));
  assert.ok(userMsg.textContent.includes('Is Gate A open?'));

  const asstMsg = container.querySelector('.chat-msg--assistant');
  assert.ok(asstMsg);
  assert.ok(asstMsg.textContent.includes('Assistant:'));
  assert.ok(asstMsg.textContent.includes('Yes.'));
});

test('assistant panel: mountAssistantPanel ignores empty input and does not call API', async () => {
  const container = getContainer();
  let callCount = 0;
  const api = { fetchAssistantAnswer: async () => { callCount++; return { answer: 'ok' }; } };
  
  mountAssistantPanel(container, api);
  const input = container.querySelector('input');
  const btn = container.querySelector('.btn-submit');
  
  // Enter only whitespace
  input.value = '   ';
  input.dispatchEvent(new window.Event('input'));
  btn.click();
  
  assert.equal(callCount, 0, 'API should not be called for empty/whitespace input');
});

test('assistant panel: valid input calls fetchAssistantAnswer with history, clears input on success', async () => {
  const container = getContainer();
  let capturedQuestion, capturedHistory;
  const api = {
    fetchAssistantAnswer: async (q, h) => {
      capturedQuestion = q;
      capturedHistory = h;
      return { answer: 'It is sunny.' };
    }
  };
  
  mountAssistantPanel(container, api);
  
  // 1st question
  let input = container.querySelector('input');
  let btn = container.querySelector('.btn-submit');
  input.value = 'Weather?';
  input.dispatchEvent(new window.Event('input'));
  btn.click();
  
  await new Promise(r => setTimeout(r, 10)); // wait for async
  
  assert.equal(capturedQuestion, 'Weather?');
  assert.deepEqual(capturedHistory, [], 'First question should have empty history');
  
  // After success, input is cleared and history is appended
  input = container.querySelector('input'); // Need to re-query as it was re-rendered
  assert.equal(input.value, '', 'Input should be cleared');
  
  // 2nd question
  btn = container.querySelector('.btn-submit');
  input.value = 'And Gate B?';
  input.dispatchEvent(new window.Event('input'));
  btn.click();
  
  await new Promise(r => setTimeout(r, 10));
  
  assert.equal(capturedQuestion, 'And Gate B?');
  assert.equal(capturedHistory.length, 2, 'History should contain first Q&A');
  assert.equal(capturedHistory[0].role, 'user');
  assert.equal(capturedHistory[1].role, 'assistant');
});

test('assistant panel: error response shows error state and does not corrupt history', async () => {
  const container = getContainer();
  const api = {
    fetchAssistantAnswer: async () => { throw new Error('Timeout'); }
  };
  
  mountAssistantPanel(container, api);
  const input = container.querySelector('input');
  const btn = container.querySelector('.btn-submit');
  
  input.value = 'Hello?';
  input.dispatchEvent(new window.Event('input'));
  
  await assert.doesNotReject(async () => {
    btn.click();
    await new Promise(r => setTimeout(r, 10));
  });
  
  const errEl = container.querySelector('.error-message');
  assert.ok(errEl);
  assert.equal(errEl.textContent, 'Timeout');
  
  // History should contain the user's message, but no assistant message
  const userMsgs = container.querySelectorAll('.chat-msg--user');
  const asstMsgs = container.querySelectorAll('.chat-msg--assistant');
  
  assert.equal(userMsgs.length, 1, 'User message should be appended immediately');
  assert.equal(asstMsgs.length, 0, 'No assistant message should be added on error');
  
  // Input should NOT be cleared on error so user can retry
  const newInput = container.querySelector('input');
  assert.equal(newInput.value, 'Hello?');
});

test('assistant panel: submit button and input are disabled during loading', async () => {
  const container = getContainer();
  let resolveApi;
  const apiPromise = new Promise(r => { resolveApi = r; });
  const api = {
    fetchAssistantAnswer: () => apiPromise
  };
  
  mountAssistantPanel(container, api);
  const input = container.querySelector('input');
  const btn = container.querySelector('.btn-submit');
  
  input.value = 'Loading test';
  input.dispatchEvent(new window.Event('input'));
  btn.click();
  
  // Now it's in loading state (API promise not resolved yet)
  const loadingInput = container.querySelector('input');
  const loadingBtn = container.querySelector('.btn-submit');
  
  assert.equal(loadingInput.disabled, true, 'Input should be disabled');
  assert.equal(loadingBtn.disabled, true, 'Button should be disabled');
  
  resolveApi({ answer: 'Done' });
  await new Promise(r => setTimeout(r, 10));
  
  // Should be re-enabled
  const finalInput = container.querySelector('input');
  const finalBtn = container.querySelector('.btn-submit');
  
  assert.equal(finalInput.disabled, false);
  assert.equal(finalBtn.disabled, false);
});
