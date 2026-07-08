/**
 * @file panel-briefing.test.js
 * Tests for /public/js/panels/briefing.js using JSDOM.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Setup jsdom environment for this module
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="container"></div></body></html>`);
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { renderBriefingPanel, mountBriefingPanel } = await import('../public/js/panels/briefing.js');

function getContainer() {
  const c = document.getElementById('container');
  c.innerHTML = '';
  return c;
}

// ---------------------------------------------------------------------------

test('briefing panel: initial render shows button and empty state', () => {
  const container = getContainer();
  renderBriefingPanel(container, { loading: false, briefing: null, error: null });
  
  const btn = container.querySelector('button');
  assert.ok(btn, 'Button should exist');
  assert.equal(btn.disabled, false, 'Button should not be disabled');
  
  const emptyState = container.querySelector('.empty-state');
  assert.ok(emptyState, 'Empty state text should be visible');
});

test('briefing panel: loading state shows indicator and disables button', () => {
  const container = getContainer();
  renderBriefingPanel(container, { loading: true, briefing: null, error: null });
  
  const btn = container.querySelector('button');
  assert.equal(btn.disabled, true, 'Button should be disabled during loading');
  
  const loading = container.querySelector('.loading-indicator');
  assert.ok(loading, 'Loading indicator should be visible');
  
  const ariaLive = container.querySelector('[aria-live="polite"]');
  assert.ok(ariaLive.contains(loading), 'Loading indicator should be inside aria-live region');
});

test('briefing panel: success state shows briefing text in aria-live region', () => {
  const container = getContainer();
  renderBriefingPanel(container, { loading: false, briefing: 'All clear.', error: null });
  
  const textEl = container.querySelector('.briefing-text');
  assert.ok(textEl, 'Briefing text element should exist');
  assert.equal(textEl.textContent, 'All clear.', 'Briefing text should match state');
  
  const ariaLive = container.querySelector('[aria-live="polite"]');
  assert.ok(ariaLive.contains(textEl), 'Briefing text should be inside aria-live region');
});

test('briefing panel: error state shows error message', () => {
  const container = getContainer();
  renderBriefingPanel(container, { loading: false, briefing: null, error: 'Network fail' });
  
  const errEl = container.querySelector('.error-message');
  assert.ok(errEl, 'Error element should exist');
  assert.equal(errEl.textContent, 'Network fail', 'Error text should match state');
});

test('briefing panel: mountBriefingPanel clicking button triggers api.fetchBriefing', async () => {
  const container = getContainer();
  let callCount = 0;
  
  // Fake API client
  const api = {
    fetchBriefing: async () => {
      callCount++;
      return { briefing: 'Generated OK.' };
    }
  };
  
  mountBriefingPanel(container, api);
  
  const btn = container.querySelector('button');
  btn.click();
  
  // Need to wait a tick for the async API call to resolve and re-render
  await new Promise(resolve => setTimeout(resolve, 10));
  
  assert.equal(callCount, 1, 'API should be called once');
  const textEl = container.querySelector('.briefing-text');
  assert.ok(textEl, 'Should render the returned briefing');
  assert.equal(textEl.textContent, 'Generated OK.');
});

test('briefing panel: mountBriefingPanel catches API errors and displays them without throwing', async () => {
  const container = getContainer();
  
  // Fake API client that rejects
  const api = {
    fetchBriefing: async () => {
      throw new Error('API timed out.');
    }
  };
  
  // mount must not throw
  mountBriefingPanel(container, api);
  
  const btn = container.querySelector('button');
  
  // We use doesNotThrow with an async wrapper to ensure the rejection is caught inside the handler
  await assert.doesNotReject(async () => {
    btn.click();
    await new Promise(resolve => setTimeout(resolve, 10));
  });
  
  // The error should be surfaced to the UI
  const errEl = container.querySelector('.error-message');
  assert.ok(errEl, 'Error message should be rendered');
  assert.equal(errEl.textContent, 'API timed out.', 'UI should show the caught error message');
});
