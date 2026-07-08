/**
 * @file panel-broadcast.test.js
 * Tests for /public/js/panels/broadcast.js using JSDOM.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Setup jsdom environment for this module
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="container"></div></body></html>`);
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { renderBroadcastPanel, mountBroadcastPanel } = await import('../public/js/panels/broadcast.js');

function getContainer() {
  const c = document.getElementById('container');
  c.innerHTML = '';
  return c;
}

// ---------------------------------------------------------------------------

test('broadcast panel: initial render shows textarea, language list, and submit button', () => {
  const container = getContainer();
  renderBroadcastPanel(container, {
    message: '', selectedLanguages: [], loading: false, result: null, error: null
  });
  
  const textarea = container.querySelector('.broadcast-textarea');
  assert.ok(textarea);
  assert.equal(textarea.disabled, false);
  
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  assert.ok(checkboxes.length >= 5, 'Should have at least 5 language checkboxes');
  
  const btn = container.querySelector('.btn-submit-broadcast');
  assert.ok(btn);
  assert.equal(btn.disabled, false);
});

test('broadcast panel: mountBroadcastPanel character counter updates on input without re-rendering everything', () => {
  const container = getContainer();
  mountBroadcastPanel(container, {});
  
  const textarea = container.querySelector('.broadcast-textarea');
  const counter = container.querySelector('.broadcast-counter');
  assert.ok(counter.textContent.includes('0 / 300'));
  
  textarea.value = 'Hello';
  textarea.dispatchEvent(new window.Event('input'));
  
  assert.ok(counter.textContent.includes('5 / 300'), 'Counter should update on input');
});

test('broadcast panel: mountBroadcastPanel blocks submit with no languages selected', async () => {
  const container = getContainer();
  let callCount = 0;
  const api = { fetchBroadcast: async () => { callCount++; return {}; } };
  
  mountBroadcastPanel(container, api);
  const textarea = container.querySelector('.broadcast-textarea');
  const btn = container.querySelector('.btn-submit-broadcast');
  
  textarea.value = 'Valid message';
  textarea.dispatchEvent(new window.Event('input'));
  
  // Submit with no languages checked
  btn.click();
  
  assert.equal(callCount, 0, 'API should not be called without languages');
  
  const errEl = container.querySelector('.error-message');
  assert.ok(errEl);
  assert.ok(errEl.textContent.includes('Select at least one language'));
});

test('broadcast panel: mountBroadcastPanel blocks submit with empty message', async () => {
  const container = getContainer();
  let callCount = 0;
  const api = { fetchBroadcast: async () => { callCount++; return {}; } };
  
  mountBroadcastPanel(container, api);
  
  // Check a language
  const cb = container.querySelector('input[value="es"]');
  cb.checked = true;
  cb.dispatchEvent(new window.Event('change'));
  
  const btn = container.querySelector('.btn-submit-broadcast');
  btn.click(); // message is empty
  
  assert.equal(callCount, 0, 'API should not be called with empty message');
  
  const errEl = container.querySelector('.error-message');
  assert.ok(errEl);
  assert.ok(errEl.textContent.includes('Message cannot be empty'));
});

test('broadcast panel: successful result renders blocks with correct lang attributes', async () => {
  const container = getContainer();
  const api = {
    fetchBroadcast: async (msg, langs) => {
      return {
        translations: [
          { language: 'es', text: 'Hola' },
          { language: 'fr', text: 'Bonjour' }
        ],
        plainLanguage: 'Hello plain',
        cached: false
      };
    }
  };
  
  mountBroadcastPanel(container, api);
  
  // Fill input
  const textarea = container.querySelector('.broadcast-textarea');
  textarea.value = 'Hello complex';
  textarea.dispatchEvent(new window.Event('input'));
  
  // Check languages
  const cbEs = container.querySelector('input[value="es"]');
  cbEs.checked = true;
  cbEs.dispatchEvent(new window.Event('change'));
  
  const cbFr = container.querySelector('input[value="fr"]');
  cbFr.checked = true;
  cbFr.dispatchEvent(new window.Event('change'));
  
  const btn = container.querySelector('.btn-submit-broadcast');
  btn.click();
  
  await new Promise(r => setTimeout(r, 10)); // wait for API
  
  // Verify results
  const results = container.querySelector('.broadcast-results');
  assert.ok(results);
  
  const enBlock = container.querySelector('.translation-en');
  assert.ok(enBlock);
  assert.equal(enBlock.getAttribute('lang'), 'en', 'English block must have lang="en"');
  assert.ok(enBlock.textContent.includes('Hello plain'));
  
  const esBlock = container.querySelector('.translation-es');
  assert.ok(esBlock);
  assert.equal(esBlock.getAttribute('lang'), 'es', 'Spanish block must have lang="es"');
  assert.ok(esBlock.textContent.includes('Hola'));
  
  const frBlock = container.querySelector('.translation-fr');
  assert.ok(frBlock);
  assert.equal(frBlock.getAttribute('lang'), 'fr', 'French block must have lang="fr"');
  assert.ok(frBlock.textContent.includes('Bonjour'));
  
  // Should not show cached badge
  const cachedBadge = container.querySelector('.cached-badge');
  assert.equal(cachedBadge, null, 'Cached badge should not be present if cached=false');
});

test('broadcast panel: cached result shows the (cached) badge', async () => {
  const container = getContainer();
  const api = {
    fetchBroadcast: async () => ({ translations: [], plainLanguage: 'x', cached: true })
  };
  
  mountBroadcastPanel(container, api);
  const textarea = container.querySelector('.broadcast-textarea');
  textarea.value = 'x';
  textarea.dispatchEvent(new window.Event('input'));
  
  const cbEs = container.querySelector('input[value="es"]');
  cbEs.checked = true;
  cbEs.dispatchEvent(new window.Event('change'));
  
  const btn = container.querySelector('.btn-submit-broadcast');
  btn.click();
  await new Promise(r => setTimeout(r, 10));
  
  const cachedBadge = container.querySelector('.cached-badge');
  assert.ok(cachedBadge, 'Cached badge should be present if cached=true');
  assert.ok(cachedBadge.textContent.includes('cached'));
});

test('broadcast panel: error state shows message without crashing', async () => {
  const container = getContainer();
  const api = {
    fetchBroadcast: async () => { throw new Error('API down'); }
  };
  
  mountBroadcastPanel(container, api);
  const textarea = container.querySelector('.broadcast-textarea');
  textarea.value = 'Test';
  textarea.dispatchEvent(new window.Event('input'));
  
  const cb = container.querySelector('input[value="es"]');
  cb.checked = true;
  cb.dispatchEvent(new window.Event('change'));
  
  const btn = container.querySelector('.btn-submit-broadcast');
  
  await assert.doesNotReject(async () => {
    btn.click();
    await new Promise(r => setTimeout(r, 10));
  });
  
  const errEl = container.querySelector('.error-message');
  assert.ok(errEl);
  assert.equal(errEl.textContent, 'API down');
});
