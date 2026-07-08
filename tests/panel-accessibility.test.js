/**
 * @file panel-accessibility.test.js
 * Tests for /public/js/panels/accessibility.js using JSDOM.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Setup jsdom environment for this module
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="container"></div></body></html>`);
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { renderAccessibilityPanel, mountAccessibilityPanel } = await import('../public/js/panels/accessibility.js');

function getContainer() {
  const c = document.getElementById('container');
  c.innerHTML = '';
  return c;
}

// ---------------------------------------------------------------------------

test('accessibility panel: initial render shows button and empty state', () => {
  const container = getContainer();
  renderAccessibilityPanel(container, { loading: false, ranked: null, dispatched: new Set(), error: null });
  
  const btn = container.querySelector('.btn-primary');
  assert.ok(btn);
  assert.equal(btn.disabled, false);
  
  const emptyState = container.querySelector('.empty-state');
  assert.ok(emptyState);
  assert.ok(emptyState.textContent.includes('Get Insights'));
});

test('accessibility panel: mountAccessibilityPanel renders items in urgencyRank order on successful fetch', async () => {
  const container = getContainer();
  const mockRanked = [
    { id: 'req_b', urgencyRank: 2, type: 'Mobility Assist', gateId: 'C', minutesOpen: 5, suggestedAction: 'Dispatch staff' },
    { id: 'req_a', urgencyRank: 1, type: 'Medical', gateId: 'D', minutesOpen: 10, suggestedAction: 'Send medic' },
    { id: 'req_c', urgencyRank: 3, type: 'Information', gateId: 'A', minutesOpen: 2, suggestedAction: 'Direct to info booth' }
  ];
  
  const api = {
    fetchAccessibilityInsights: async () => ({ ranked: mockRanked })
  };
  
  mountAccessibilityPanel(container, api);
  
  const btn = container.querySelector('.btn-primary');
  btn.click(); // trigger fetch
  
  await new Promise(r => setTimeout(r, 10)); // wait for API
  
  const cards = container.querySelectorAll('.access-req');
  assert.equal(cards.length, 3, 'Should render 3 request cards');
  
  // Verify order matches urgencyRank (1, 2, 3), which means req_a, req_b, req_c
  assert.equal(cards[0].getAttribute('data-req-id'), 'req_a', 'First card should be rank 1');
  assert.equal(cards[1].getAttribute('data-req-id'), 'req_b', 'Second card should be rank 2');
  assert.equal(cards[2].getAttribute('data-req-id'), 'req_c', 'Third card should be rank 3');
});

test('accessibility panel: dispatching an item marks it disabled and updates UI without hitting API', async () => {
  const container = getContainer();
  let fetchCount = 0;
  
  const api = {
    fetchAccessibilityInsights: async () => {
      fetchCount++;
      return {
        ranked: [
          { id: 'r1', urgencyRank: 1, type: 'A', gateId: '1', minutesOpen: 1, suggestedAction: 'A' },
          { id: 'r2', urgencyRank: 2, type: 'B', gateId: '2', minutesOpen: 2, suggestedAction: 'B' }
        ]
      };
    }
  };
  
  mountAccessibilityPanel(container, api);
  container.querySelector('.btn-primary').click();
  await new Promise(r => setTimeout(r, 10));
  
  assert.equal(fetchCount, 1);
  
  const card1 = container.querySelector('[data-req-id="r1"]');
  const card2 = container.querySelector('[data-req-id="r2"]');
  
  const dispatchBtn1 = card1.querySelector('button');
  const dispatchBtn2 = card2.querySelector('button');
  
  assert.equal(dispatchBtn1.disabled, false);
  assert.equal(dispatchBtn2.disabled, false);
  
  // Click dispatch on first item
  dispatchBtn1.click();
  
  // Should re-render, so re-query elements
  const updatedCard1 = container.querySelector('[data-req-id="r1"]');
  const updatedCard2 = container.querySelector('[data-req-id="r2"]');
  
  assert.ok(updatedCard1.classList.contains('completed'), 'Card 1 should get completed class');
  assert.ok(!updatedCard2.classList.contains('completed'), 'Card 2 should NOT get completed class');
  
  assert.equal(updatedCard1.querySelector('button').disabled, true, 'Dispatch button 1 should be disabled');
  assert.equal(updatedCard2.querySelector('button').disabled, false, 'Dispatch button 2 should stay enabled');
  
  assert.equal(fetchCount, 1, 'Dispatching should not trigger another API fetch');
});

test('accessibility panel: error state renders without crashing', async () => {
  const container = getContainer();
  const api = {
    fetchAccessibilityInsights: async () => { throw new Error('Insights failed'); }
  };
  
  mountAccessibilityPanel(container, api);
  const btn = container.querySelector('.btn-primary');
  
  await assert.doesNotReject(async () => {
    btn.click();
    await new Promise(r => setTimeout(r, 10));
  });
  
  const errEl = container.querySelector('.error-message');
  assert.ok(errEl);
  assert.equal(errEl.textContent, 'Insights failed');
  
  // Should not have any results
  const cards = container.querySelectorAll('.access-req');
  assert.equal(cards.length, 0);
});

test('accessibility panel: empty ranked array shows empty state message', () => {
  const container = getContainer();
  renderAccessibilityPanel(container, { loading: false, ranked: [], dispatched: new Set(), error: null });
  
  const emptyState = container.querySelector('.empty-state');
  assert.ok(emptyState);
  assert.ok(emptyState.textContent.includes('No pending accessibility requests'));
});

test('accessibility panel: loading state disables button and shows loading text', () => {
  const container = getContainer();
  renderAccessibilityPanel(container, { loading: true, ranked: null, dispatched: new Set(), error: null });
  
  const btn = container.querySelector('.btn-primary');
  assert.ok(btn);
  assert.equal(btn.disabled, true);
  assert.ok(btn.textContent.includes('Analyzing'));
});
