/**
 * @file panel-statusBar.test.js
 * Tests for /public/js/panels/statusBar.js using JSDOM.
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
const { renderStatusBar, mountStatusBar } = await import('../public/js/panels/statusBar.js');

const SAMPLE_SIGNALS = {
  match: {
    homeTeam: 'USA',
    awayTeam: 'Mexico',
    competitionStage: 'Group Stage',
    matchStatus: 'pre-match'
  },
  weather: {
    condition: 'Clear',
    tempCelsius: 22,
    advisory: 'Bring a jacket.'
  },
  transit: [
    { name: 'Train', mode: 'rail', state: 'on-time', etaMinutes: 5 },
    { name: 'Bus', mode: 'bus', state: 'delayed', etaMinutes: 15 },
    { name: 'Shuttle', mode: 'shuttle', state: 'disrupted', etaMinutes: null }
  ]
};

function getContainer() {
  const c = document.getElementById('container');
  c.innerHTML = ''; // reset before each test
  return c;
}

// ---------------------------------------------------------------------------

test('statusBar: renders match, weather, and transit cards', () => {
  const container = getContainer();
  renderStatusBar(container, SAMPLE_SIGNALS);
  
  const matchCard = container.querySelector('.match-card');
  assert.ok(matchCard, 'should render match card');
  assert.ok(matchCard.textContent.includes('USA vs Mexico'), 'should render teams');
  assert.ok(matchCard.textContent.includes('PRE-MATCH'), 'should render upper-cased match status');
  
  const weatherCard = container.querySelector('.weather-card');
  assert.ok(weatherCard, 'should render weather card');
  assert.ok(weatherCard.textContent.includes('Clear, 22°C'), 'should render weather condition and temp');
  assert.ok(weatherCard.textContent.includes('Bring a jacket.'), 'should render weather advisory');
  
  const transitCard = container.querySelector('.transit-card');
  assert.ok(transitCard, 'should render transit card');
  const items = transitCard.querySelectorAll('.transit-item');
  assert.equal(items.length, 3, 'should render 3 transit items');
});

test('statusBar: gracefully handles null/empty signals', () => {
  const container = getContainer();
  assert.doesNotThrow(() => {
    renderStatusBar(container, null);
  });
  assert.equal(container.children.length, 0, 'should render nothing for null signals');
  
  assert.doesNotThrow(() => {
    renderStatusBar(container, {});
  });
  
  const textContent = container.textContent;
  assert.ok(textContent.includes('Unknown Match'), 'should fallback gracefully');
  assert.ok(textContent.includes('Unknown Condition'), 'should fallback gracefully for weather');
  assert.ok(container.querySelectorAll('.transit-item').length === 0, 'should render no transit items if empty array');
});

test('statusBar: assigns correct semantic CSS class to transit states', () => {
  const container = getContainer();
  renderStatusBar(container, SAMPLE_SIGNALS);
  
  const transitList = container.querySelector('.transit-list');
  const items = transitList.querySelectorAll('.transit-item');
  
  // Train is on-time -> --low
  assert.ok(items[0].querySelector('.transit-state--on-time'), 'on-time state should have correct class');
  
  // Bus is delayed -> --medium
  assert.ok(items[1].querySelector('.transit-state--delayed'), 'delayed state should have correct class');
  
  // Shuttle is disrupted -> --high
  assert.ok(items[2].querySelector('.transit-state--disrupted'), 'disrupted state should have correct class');
});

test('statusBar: mountStatusBar renders immediately and updates on store changes', () => {
  const container = getContainer();
  const store = createStore({ signals: SAMPLE_SIGNALS });
  
  const unsub = mountStatusBar(container, store);
  assert.ok(container.querySelector('.match-card').textContent.includes('USA vs Mexico'), 'initial render from store');
  
  store.setState({
    signals: {
      match: {
        homeTeam: 'Canada',
        awayTeam: 'Brazil'
      }
    }
  });
  
  assert.ok(container.querySelector('.match-card').textContent.includes('Canada vs Brazil'), 're-render updates match text');
  
  unsub();
});
