/**
 * @file accessibility.js
 * Accessibility Action Insights panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren } from '../utils/dom.js';

// ---------------------------------------------------------------------------
// renderAccessibilityPanel
// ---------------------------------------------------------------------------

/**
 * Renders the accessibility panel UI.
 *
 * @param {HTMLElement} container
 * @param {object} state - { loading: boolean, ranked: Array|null, dispatched: Set<string>, error: string|null }
 * @param {object} handlers - { onGenerate: Function, onDispatch: Function }
 */
export function renderAccessibilityPanel(container, state, handlers = {}) {
  clearChildren(container);

  // 1. Header and Generate Button
  const btn = el(
    'button',
    { class: 'btn-generate-accessibility', 'aria-busy': state.loading ? 'true' : 'false' },
    [state.loading ? 'Analyzing Requests...' : 'Get Insights']
  );
  if (state.loading) {
    btn.setAttribute('disabled', 'true');
  }
  btn.addEventListener('click', () => {
    if (handlers.onGenerate) handlers.onGenerate();
  });

  const header = el('header', { class: 'panel-header' }, [btn]);

  // 2. Error Message
  let errorNode = null;
  if (state.error) {
    errorNode = el('div', { class: 'error-message', role: 'alert' }, [state.error]);
  }

  // 3. Results / Insights List
  let resultsNode = null;
  if (state.ranked && state.ranked.length === 0) {
    resultsNode = el('div', { class: 'empty-state text-muted' }, ['No pending accessibility requests at this time.']);
  } else if (state.ranked) {
    resultsNode = el('div', { class: 'accessibility-insights', 'aria-live': 'polite' }, []);
    
    // Sort array by urgencyRank just in case it isn't perfectly sorted from the API
    const sorted = [...state.ranked].sort((a, b) => a.urgencyRank - b.urgencyRank);

    for (const req of sorted) {
      const isDispatched = state.dispatched.has(req.id);
      
      const reqClass = [
        'accessibility-card',
        isDispatched ? 'accessibility-card--dispatched' : ''
      ].join(' ').trim();

      const typeBadge = el('span', { class: 'accessibility-badge' }, [`Rank ${req.urgencyRank}: ${req.type}`]);
      const location = el('span', { class: 'accessibility-location' }, [`Gate ${req.gateId}`]);
      const duration = el('span', { class: 'accessibility-duration' }, [`Pending: ${req.minutesOpen}m`]);
      
      const headerRow = el('div', { class: 'accessibility-card__header' }, [typeBadge, location, duration]);
      
      const noteRow = el('p', { class: 'accessibility-note text-muted' }, [req.note || 'No additional note.']);
      
      const actionRow = el('div', { class: 'accessibility-card__action-row' }, [
        el('strong', {}, ['Suggested Action: ']),
        req.suggestedAction
      ]);

      const dispatchBtn = el(
        'button',
        { class: 'btn-dispatch' },
        [isDispatched ? '✓ Dispatched' : 'Mark as Dispatched']
      );
      
      if (isDispatched) {
        dispatchBtn.setAttribute('disabled', 'true');
      } else {
        dispatchBtn.addEventListener('click', () => {
          if (handlers.onDispatch) handlers.onDispatch(req.id);
        });
      }

      const card = el('article', { class: reqClass, 'data-req-id': req.id }, [
        headerRow,
        noteRow,
        actionRow,
        el('div', { class: 'accessibility-card__footer' }, [dispatchBtn])
      ]);

      resultsNode.appendChild(card);
    }
  } else if (!state.loading && !state.error) {
    // Initial empty state
    resultsNode = el('div', { class: 'empty-state text-muted' }, ['Click "Get Insights" to rank pending accessibility requests.']);
  }

  // Assemble
  container.appendChild(header);
  if (errorNode) container.appendChild(errorNode);
  if (resultsNode) container.appendChild(resultsNode);
}

// ---------------------------------------------------------------------------
// mountAccessibilityPanel
// ---------------------------------------------------------------------------

/**
 * Wires the accessibility panel logic.
 *
 * @param {HTMLElement} container
 * @param {{ fetchAccessibilityInsights: Function }} api
 */
export function mountAccessibilityPanel(container, api) {
  let state = {
    loading: false,
    ranked: null,
    dispatched: new Set(),
    error: null,
  };

  const update = (partial) => {
    state = { ...state, ...partial };
    renderAccessibilityPanel(container, state, { onGenerate: handleGenerate, onDispatch: handleDispatch });
  };

  const handleDispatch = (id) => {
    // We explicitly treat this as client-side-only state per the requirements
    const nextDispatched = new Set(state.dispatched);
    nextDispatched.add(id);
    update({ dispatched: nextDispatched });
  };

  const handleGenerate = async () => {
    if (state.loading) return;

    update({ loading: true, error: null, ranked: null });

    try {
      const res = await api.fetchAccessibilityInsights();
      // Keep existing dispatched set across refreshes
      update({ loading: false, ranked: res.ranked });
    } catch (err) {
      update({ loading: false, error: err.message });
    }
  };

  // Initial render
  renderAccessibilityPanel(container, state, { onGenerate: handleGenerate, onDispatch: handleDispatch });
}
