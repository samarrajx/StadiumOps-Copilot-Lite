/**
 * @file gateGrid.js
 * Gate status grid panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() from P4 throughout — never innerHTML
 * with dynamic data. All gate fields are interpolated as text nodes only.
 */import { el, clearChildren, refreshIcons } from '../utils/dom.js';
import { formatWaitTime, formatSeverityLabel } from '../utils/formatters.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DENSITY_WIDTH = {
  low: '30%',
  medium: '65%',
  high: '95%',
};

const DENSITY_BG = {
  low: 'var(--color-success)',
  medium: 'var(--color-warning)',
  high: 'var(--color-danger)',
};

const DENSITY_BADGE = {
  low: 'badge-low',
  medium: 'badge-medium',
  high: 'badge-high',
};

const TREND_LUCIDE = {
  rising: 'trending-up',
  falling: 'trending-down',
  stable: 'minus',
};

const TREND_LABEL = {
  rising: 'Rising',
  falling: 'Falling',
  stable: 'Stable',
};

// ---------------------------------------------------------------------------
// renderGateGrid
// ---------------------------------------------------------------------------

/**
 * Renders the gate status grid into `container`, including the AI routing
 * recommendation section and one card per gate in `signals.gates`.
 *
 * @param {HTMLElement} container        - DOM node to render into.
 * @param {object|null} signals          - Live signals snapshot (signals.gates array);
 *                                         pass null to render an empty grid.
 * @param {object}      [aiConfig={}]    - AI recommendation display config.
 * @param {{ status: 'idle'|'loading'|'error'|'success', data: string|null, error: string|null }} [aiConfig.recState]
 *   - Current recommendation state.
 * @param {Function}    [aiConfig.onRecommend] - Callback fired when the AI button is clicked.
 * @returns {void}
 */
export function renderGateGrid(container, signals, aiConfig = {}) {
  clearChildren(container);

  const { recState = { status: 'idle', data: null, error: null }, onRecommend = () => {} } = aiConfig;

  // AI Recommendation Section
  const aiBtn = el('button', { class: 'btn btn-gate-ai' }, [
    el('i', { 'data-lucide': 'sparkles' }),
    recState.status === 'loading' ? 'Analyzing live conditions...' : 'Get AI Routing Plan'
  ]);
  if (recState.status === 'loading') {
    aiBtn.setAttribute('disabled', 'true');
  }
  aiBtn.addEventListener('click', onRecommend);

  let aiContent = null;
  if (recState.status === 'loading') {
    aiContent = el('div', { class: 'skeleton mt-2' }, [el('div', {style: 'height:60px'}, [])]);
  } else if (recState.status === 'error') {
    aiContent = el('div', { class: 'ai-recommendation-card' }, [
      el('span', { class: 'text-danger' }, [recState.error])
    ]);
  } else if (recState.status === 'success' && recState.data) {
    aiContent = el('div', { class: 'ai-recommendation-card' }, [
      el('span', { class: 'ai-label' }, [
        el('i', { 'data-lucide': 'check-circle' }),
        'Recommendation'
      ]),
      recState.data
    ]);
  }

  const aiHeader = el('div', { class: 'gate-ai-section' }, [
    aiBtn,
    ...(aiContent ? [aiContent] : [])
  ]);
  container.appendChild(aiHeader);

  // Render Gate Cards
  const gates = signals?.gates ?? [];

  for (const gate of gates) {
    const accessible = gate.wheelchairAccessible;

    // Density badge
    const densityBadge = el(
      'span',
      { class: `badge ${DENSITY_BADGE[gate.density] ?? 'badge-outline'}` },
      [formatSeverityLabel(gate.density)]
    );

    // Wait time
    const waitEl = el('div', { class: 'gate-metric' }, [
      el('i', { 'data-lucide': 'clock' }),
      el('span', { class: 'gate-metric-val' }, [formatWaitTime(gate.waitTimeMinutes)])
    ]);

    // Trend indicator
    const trendEl = el('div', { class: 'gate-metric' }, [
      el('i', { 'data-lucide': TREND_LUCIDE[gate.trend] ?? 'minus' }),
      el('span', { class: 'gate-metric-val' }, [TREND_LABEL[gate.trend] ?? 'Stable'])
    ]);

    // Wheelchair accessibility
    const accessEl = el('div', { class: `gate-metric mt-2 ${accessible ? 'text-success' : 'text-danger'}` }, [
      el('i', { 'data-lucide': accessible ? 'wheelchair' : 'alert-triangle' }),
      el('span', { class: 'gate-metric-val', style: accessible ? '' : 'color: var(--color-danger)' }, [
        accessible ? 'Accessible' : 'No Wheelchair Access'
      ])
    ]);

    // Progress Bar for Density
    const progressContainer = el('div', { class: 'progress-container' }, [
      el('div', { 
        class: 'progress-bar', 
        style: `width: ${DENSITY_WIDTH[gate.density] ?? '0%'}; background: ${DENSITY_BG[gate.density] ?? 'var(--text-muted)'};`
      }, [])
    ]);

    // Card
    const cardClass = `gate-card ${accessible ? '' : 'gate-card--no-wheelchair'}`;
    const card = el('article', { class: cardClass, 'data-gate-id': gate.id }, [
      el('header', { class: 'gate-card__header' }, [
        el('h3', { class: 'gate-card__title' }, [gate.label ?? `Gate ${gate.id}`]),
        densityBadge,
      ]),
      el('div', { class: 'text-muted text-sm mb-2' }, [`Zone: ${gate.zone}`]),
      progressContainer,
      el('div', { class: 'gate-card__metrics' }, [
        waitEl,
        trendEl,
      ]),
      accessEl,
    ]);

    container.appendChild(card);
  }

  refreshIcons();
}

// ---------------------------------------------------------------------------
// mountGateGrid
// ---------------------------------------------------------------------------

/**
 * Subscribes the gate grid to a store, rendering immediately and on every
 * subsequent state update.
 *
 * @param {HTMLElement}                         container - DOM node to render into.
 * @param {{ getState: Function, subscribe: Function }} store - App state store.
 * @returns {Function} Unsubscribe function — call to detach this panel.
 */
export function mountGateGrid(container, store) {
  let recState = { status: 'idle', data: null, error: null };

  const handleRecommendClick = async () => {
    recState = { status: 'loading', data: null, error: null };
    render(); // force re-render with loading state
    try {
      // dynamic import to avoid circular dependency issues and keep the module pure if api is missing
      const { fetchGateRecommendation } = await import('../api.js');
      const res = await fetchGateRecommendation();
      recState = { status: 'success', data: res.recommendation, error: null };
    } catch (err) {
      recState = { status: 'error', data: null, error: err.message };
    }
    render(); // force re-render with success/error state
  };

  const render = (state = store.getState()) => {
    renderGateGrid(container, state.signals ?? null, {
      recState,
      onRecommend: handleRecommendClick
    });
  };

  // Render once immediately with current state
  render();

  // Subscribe to future state changes
  return store.subscribe(render);
}
