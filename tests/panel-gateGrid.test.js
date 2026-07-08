/**
 * @file panel-gateGrid.test.js
 * Tests for /public/js/panels/gateGrid.js using JSDOM.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createStore } from '../public/js/state.js';

// Setup jsdom environment for this module
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="container"></div></body></html>`);
globalThis.window = dom.window;
globalThis.document = dom.window.document;

// Import after setting up globals because utils/dom.js relies on document
const { renderGateGrid, mountGateGrid } = await import('../public/js/panels/gateGrid.js');

const SAMPLE_SIGNALS = {
  gates: [
    { id: 'A', label: 'Gate A', zone: 'North', density: 'low', waitTimeMinutes: 2, trend: 'falling', wheelchairAccessible: true },
    { id: 'C', label: 'Gate C', zone: 'East', density: 'high', waitTimeMinutes: 15, trend: 'rising', wheelchairAccessible: false },
    { id: 'D', label: 'Gate D', zone: 'South', density: 'medium', waitTimeMinutes: 5, trend: 'stable', wheelchairAccessible: true },
  ],
};

function getContainer() {
  const c = document.getElementById('container');
  c.innerHTML = ''; // reset before each test
  return c;
}

// ---------------------------------------------------------------------------

test('gateGrid: renderGateGrid renders the correct number of gate cards', () => {
  const container = getContainer();
  renderGateGrid(container, SAMPLE_SIGNALS);
  const cards = container.querySelectorAll('.gate-card');
  assert.equal(cards.length, 3, 'should render 3 gate cards');
});

test('gateGrid: empty gates array renders without throwing', () => {
  const container = getContainer();
  assert.doesNotThrow(() => {
    renderGateGrid(container, { gates: [] });
  });
  assert.equal(container.querySelectorAll('.gate-card').length, 0, 'should render 0 gate cards');
});

test('gateGrid: null signals renders without throwing', () => {
  const container = getContainer();
  assert.doesNotThrow(() => {
    renderGateGrid(container, null);
  });
  assert.equal(container.querySelectorAll('.gate-card').length, 0, 'should render 0 gate cards');
});

test('gateGrid: Gate C gets the distinct non-accessible styling class', () => {
  const container = getContainer();
  renderGateGrid(container, SAMPLE_SIGNALS);
  const gateCCard = container.querySelector('[data-gate-id="C"]');
  assert.ok(gateCCard, 'Gate C card should exist');
  assert.ok(gateCCard.classList.contains('gate-card--no-wheelchair'), 'Gate C should have no-wheelchair modifier class');
  const accessDiv = gateCCard.querySelector('.text-danger');
  assert.ok(accessDiv, 'Gate C should have danger class for accessibility');
  assert.ok(accessDiv.innerHTML.includes('data-lucide="alert-triangle"'), 'Gate C access indicator should include warning icon');
});

test('gateGrid: accessible gates get the accessible styling class', () => {
  const container = getContainer();
  renderGateGrid(container, SAMPLE_SIGNALS);
  const gateACard = container.querySelector('[data-gate-id="A"]');
  assert.ok(gateACard, 'Gate A card should exist');
  assert.ok(!gateACard.classList.contains('gate-card--no-wheelchair'), 'Gate A should not have warning class');
  const accessDiv = gateACard.querySelector('.text-success');
  assert.ok(accessDiv, 'Gate A should have success class for accessibility');
  assert.ok(accessDiv.innerHTML.includes('data-lucide="wheelchair"'), 'Gate A access indicator should include wheelchair icon');
});

test('gateGrid: wait times are rendered formatted, not as raw numbers', () => {
  const container = getContainer();
  renderGateGrid(container, SAMPLE_SIGNALS);
  const gateACard = container.querySelector('[data-gate-id="A"]');
  const waitEl = gateACard.querySelector('.gate-metric-val'); // First one is wait time
  assert.ok(waitEl.textContent.includes('2 min'), 'Wait time should be formatted (e.g. 2 min)');
  assert.ok(!waitEl.textContent.trim().match(/^2$/), 'Wait time should not be just the raw number');
});

test('gateGrid: mountGateGrid renders immediately and updates on store changes', () => {
  const container = getContainer();
  const store = createStore({ signals: SAMPLE_SIGNALS });
  
  // Mount and check initial render
  const unsub = mountGateGrid(container, store);
  assert.equal(container.querySelectorAll('.gate-card').length, 3, 'initial render from store should have 3 cards');
  
  // Update store with fewer gates
  store.setState({
    signals: { gates: [ SAMPLE_SIGNALS.gates[0] ] }
  });
  
  // Re-render should replace content, not duplicate (clearChildren works)
  assert.equal(container.querySelectorAll('.gate-card').length, 1, 're-render should result in 1 card');
  assert.equal(container.querySelector('[data-gate-id="A"]').textContent.includes('Gate A'), true);
  
  unsub();
});
