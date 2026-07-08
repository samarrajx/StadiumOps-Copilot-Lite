/**
 * @file accessibility.js
 * Accessibility Action Insights panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren, refreshIcons } from '../utils/dom.js';

// ---------------------------------------------------------------------------
// renderAccessibilityPanel
// ---------------------------------------------------------------------------

export function renderAccessibilityPanel(container, state, handlers = {}) {
  clearChildren(container);

  // 1. Header and Generate Button
  const btn = el(
    'button',
    { class: 'btn btn-primary', 'aria-busy': state.loading ? 'true' : 'false' },
    [
      el('i', { 'data-lucide': 'list-checks' }),
      state.loading ? 'Analyzing Requests...' : 'Get Insights'
    ]
  );
  if (state.loading) {
    btn.setAttribute('disabled', 'true');
  }
  btn.addEventListener('click', () => {
    if (handlers.onGenerate) handlers.onGenerate();
  });

  const btnRow = el('div', { class: 'mb-4' }, [btn]);

  // 2. Error Message
  let errorNode = null;
  if (state.error) {
    errorNode = el('div', { class: 'error-message text-danger', role: 'alert' }, [state.error]);
  }

  // 3. Results / Insights List
  let resultsNode = null;
  if (state.loading && !state.ranked) {
    resultsNode = el('div', { class: 'skeleton mt-2' }, [el('div', {style: 'height:200px'}, [])]);
  } else if (state.ranked && state.ranked.length === 0) {
    resultsNode = el('div', { class: 'empty-state text-muted flex flex-col items-center mt-4' }, [
      el('i', { 'data-lucide': 'check-circle' }),
      'No pending accessibility requests at this time.'
    ]);
  } else if (state.ranked) {
    resultsNode = el('div', { class: 'access-queue mt-2', 'aria-live': 'polite' }, []);
    
    // Sort array by urgencyRank
    const sorted = [...state.ranked].sort((a, b) => a.urgencyRank - b.urgencyRank);

    for (const req of sorted) {
      const isDispatched = state.dispatched.has(req.id);
      
      const reqClass = [
        'access-req',
        isDispatched ? 'completed' : ''
      ].join(' ').trim();

      const badgeColor = req.urgencyRank === 1 ? 'badge-high' : req.urgencyRank === 2 ? 'badge-medium' : 'badge-outline';
      const typeBadge = el('span', { class: `badge ${badgeColor}` }, [`Rank ${req.urgencyRank}: ${req.type}`]);
      
      const metaRow = el('div', { class: 'access-meta mt-1' }, [
        el('span', {}, [el('i', { 'data-lucide': 'map-pin', style: 'width:12px;height:12px' }), ` Gate ${req.gateId}`]),
        el('span', {}, [el('i', { 'data-lucide': 'clock', style: 'width:12px;height:12px' }), ` ${req.minutesOpen}m`])
      ]);
      
      const noteRow = el('p', { class: 'text-muted text-xs mt-1' }, [req.note || 'No additional note.']);
      
      const actionRow = el('div', { class: 'text-xs text-info mt-1' }, [
        el('strong', {}, ['Action: ']),
        req.suggestedAction
      ]);

      const infoSection = el('div', { class: 'access-info' }, [
        typeBadge,
        metaRow,
        noteRow,
        actionRow
      ]);

      const dispatchBtn = el(
        'button',
        { class: 'btn' },
        [
          el('i', { 'data-lucide': 'check' }),
          isDispatched ? 'Dispatched' : 'Dispatch'
        ]
      );
      
      if (isDispatched) {
        dispatchBtn.setAttribute('disabled', 'true');
        dispatchBtn.classList.add('text-success');
      } else {
        dispatchBtn.addEventListener('click', () => {
          if (handlers.onDispatch) handlers.onDispatch(req.id);
        });
      }

      const card = el('article', { class: reqClass, 'data-req-id': req.id }, [
        infoSection,
        el('div', { class: 'ml-4' }, [dispatchBtn])
      ]);

      resultsNode.appendChild(card);
    }
  } else if (!state.loading && !state.error) {
    // Initial empty state
    resultsNode = el('div', { class: 'empty-state text-muted flex flex-col items-center mt-4' }, [
      el('i', { 'data-lucide': 'list' }),
      'Click "Get Insights" to rank pending requests.'
    ]);
  }

  // Assemble
  container.appendChild(btnRow);
  if (errorNode) container.appendChild(errorNode);
  if (resultsNode) container.appendChild(resultsNode);
  
  refreshIcons();
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
