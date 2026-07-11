/**
 * @file briefing.js
 * Situation Briefing panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren, refreshIcons, renderMarkdownToDOM } from '../utils/dom.js';

// ---------------------------------------------------------------------------
// renderBriefingPanel
// ---------------------------------------------------------------------------

/**
 * Renders the briefing panel UI into `container`.
 * Shows a generate button, a loading skeleton, the AI-generated markdown
 * briefing, or an empty-state prompt depending on `state`.
 *
 * @param {HTMLElement} container               - DOM node to render into.
 * @param {{ loading: boolean, briefing: string|null, error: string|null }} state
 *   - Current panel state.
 * @param {Function}    [onGenerate=()=>{}]     - Callback fired when the generate button is clicked.
 * @returns {void}
 */
export function renderBriefingPanel(container, state, onGenerate = () => {}) {
  clearChildren(container);

  // Button row
  const btn = el(
    'button',
    { class: 'btn btn-primary', 'aria-busy': state.loading ? 'true' : 'false' },
    [
      el('i', { 'data-lucide': 'sparkles' }),
      state.loading ? 'Generating...' : 'Generate Briefing'
    ]
  );
  if (state.loading) {
    btn.setAttribute('disabled', 'true');
  }
  btn.addEventListener('click', onGenerate);

  const btnRow = el('div', { class: 'mb-4' }, [btn]);

  // Content area
  const contentArea = el('div', {
    class: 'briefing-content',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });

  if (state.loading) {
    contentArea.appendChild(el('div', { class: 'skeleton' }, [el('div', {style: 'height:150px'}, [])]));
  } else if (state.error) {
    contentArea.appendChild(el('div', { class: 'error-message text-danger', role: 'alert' }, [state.error]));
  } else if (state.briefing) {
    // AI Badge
    const badge = el('div', { class: 'ai-badge' }, [
      el('i', { 'data-lucide': 'cpu' }),
      'AI Generated'
    ]);
    contentArea.appendChild(badge);

    // Markdown DOM nodes
    const mdNodes = renderMarkdownToDOM(state.briefing);
    for (const node of mdNodes) {
      contentArea.appendChild(node);
    }
  } else {
    // Initial state (empty)
    const emptyState = el('div', { class: 'empty-state text-muted flex flex-col items-center gap-2 mt-4' }, [
      el('i', { 'data-lucide': 'inbox' }),
      'Click "Generate Briefing" for an AI executive summary.'
    ]);
    contentArea.appendChild(emptyState);
  }

  container.appendChild(btnRow);
  container.appendChild(contentArea);
  refreshIcons();
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
