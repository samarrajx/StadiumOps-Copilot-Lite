/**
 * @file briefing.js
 * Situation Briefing panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren } from '../utils/dom.js';

// ---------------------------------------------------------------------------
// renderBriefingPanel
// ---------------------------------------------------------------------------

/**
 * Renders the UI based on local state (loading, briefing text, error).
 *
 * @param {HTMLElement} container
 * @param {object} state - { loading: boolean, briefing: string|null, error: string|null }
 * @param {Function} [onGenerate] - Click handler for the button (optional for pure render testing)
 */
export function renderBriefingPanel(container, state, onGenerate = () => {}) {
  clearChildren(container);

  // Button header
  const btn = el(
    'button',
    { class: 'btn-generate', 'aria-busy': state.loading ? 'true' : 'false' },
    [state.loading ? 'Generating...' : 'Generate Briefing']
  );
  if (state.loading) {
    btn.setAttribute('disabled', 'true');
  }
  btn.addEventListener('click', onGenerate);

  const header = el('header', { class: 'panel-header' }, [btn]);

  // Content area: only one of loading / error / briefing shows at a time.
  // The content container uses aria-live to announce updates to screen readers.
  const contentArea = el('div', {
    class: 'briefing-content',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });

  if (state.loading) {
    contentArea.appendChild(el('div', { class: 'loading-indicator' }, ['Analyzing live signals...']));
  } else if (state.error) {
    contentArea.appendChild(el('div', { class: 'error-message', role: 'alert' }, [state.error]));
  } else if (state.briefing) {
    // Briefing text is expected to be plain text, but we append it safely as text nodes.
    contentArea.appendChild(el('p', { class: 'briefing-text' }, [state.briefing]));
  } else {
    // Initial state (empty)
    contentArea.appendChild(el('p', { class: 'empty-state text-muted' }, ['Click "Generate Briefing" to get a situation report.']));
  }

  container.appendChild(header);
  container.appendChild(contentArea);
}

// ---------------------------------------------------------------------------
// mountBriefingPanel
// ---------------------------------------------------------------------------

/**
 * Wires the panel logic, maintaining local state and calling the API.
 *
 * @param {HTMLElement} container
 * @param {{ fetchBriefing: Function }} api - Injected API client
 */
export function mountBriefingPanel(container, api) {
  let state = {
    loading: false,
    briefing: null,
    error: null,
  };

  const update = (partial) => {
    state = { ...state, ...partial };
    renderBriefingPanel(container, state, handleGenerate);
  };

  const handleGenerate = async () => {
    if (state.loading) return; // Prevent double-clicks

    update({ loading: true, error: null, briefing: null });

    try {
      const response = await api.fetchBriefing();
      update({ loading: false, briefing: response.briefing });
    } catch (err) {
      update({ loading: false, error: err.message });
    }
  };

  // Initial render
  renderBriefingPanel(container, state, handleGenerate);
}
