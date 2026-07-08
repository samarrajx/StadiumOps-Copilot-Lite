/**
 * @file gateGrid.js
 * Gate status grid panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() from P4 throughout — never innerHTML
 * with dynamic data. All gate fields are interpolated as text nodes only.
 */

import { el, clearChildren } from '../utils/dom.js';
import { formatWaitTime, formatSeverityLabel } from '../utils/formatters.js';

// ---------------------------------------------------------------------------
// Constants — kept here so tests can verify class names against markup
// ---------------------------------------------------------------------------

const DENSITY_CLASS = {
  low:    'density-low',
  medium: 'density-medium',
  high:   'density-high',
};

const TREND_ICON = {
  rising:  '↑',
  falling: '↓',
  stable:  '→',
};

const TREND_LABEL = {
  rising:  'Rising',
  falling: 'Falling',
  stable:  'Stable',
};

// ---------------------------------------------------------------------------
// renderGateGrid
// ---------------------------------------------------------------------------

/**
 * Clears `container` then renders one card per gate from `signals.gates`.
 * Uses CSS classes for density colour-coding and wheelchair status —
 * never inline hex colours or style attributes.
 * Gate C (wheelchairAccessible: false) gets the `gate-card--no-wheelchair`
 * class which renders with a distinct warning treatment in CSS.
 *
 * @param {HTMLElement} container
 * @param {object|null} signals - LiveSignals object (may be null/undefined during loading)
 */
export function renderGateGrid(container, signals, aiConfig = {}) {
  clearChildren(container);

  const { recState = { status: 'idle', data: null, error: null }, onRecommend = () => {} } = aiConfig;

  // AI Recommendation Section
  const aiBtn = el('button', { class: 'btn-generate btn-gate-ai' }, ['Get AI Routing Plan']);
  if (recState.status === 'loading') {
    aiBtn.setAttribute('disabled', 'true');
    aiBtn.textContent = 'Analyzing live conditions...';
  }
  aiBtn.addEventListener('click', onRecommend);

  let aiContent = null;
  if (recState.status === 'loading') {
    aiContent = el('div', { class: 'loading-indicator' }, ['Generating optimal route...']);
  } else if (recState.status === 'error') {
    aiContent = el('div', { class: 'error-message' }, [recState.error]);
  } else if (recState.status === 'success' && recState.data) {
    aiContent = el('div', { class: 'ai-recommendation-card' }, [
      el('strong', { class: 'ai-label' }, ['Recommendation: ']),
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

    // Density badge — colour comes from CSS class, never inline style
    const densityBadge = el(
      'span',
      { class: `gate-density-badge ${DENSITY_CLASS[gate.density] ?? ''}` },
      [formatSeverityLabel(gate.density)],
    );

    // Wait time — formatted via formatWaitTime, never raw number
    const waitEl = el('span', { class: 'gate-wait' }, [
      formatWaitTime(gate.waitTimeMinutes),
    ]);

    // Trend indicator
    const trendEl = el(
      'span',
      { class: `gate-trend gate-trend--${gate.trend ?? 'stable'}` },
      [TREND_ICON[gate.trend] ?? '→', ' ', TREND_LABEL[gate.trend] ?? 'Stable'],
    );

    // Wheelchair accessibility row
    const accessEl = accessible
      ? el('div', { class: 'gate-access gate-access--ok' },           ['♿ Wheelchair Accessible'])
      : el('div', { class: 'gate-access gate-access--no-wheelchair' }, ['⚠ No Wheelchair Access — use nearest accessible gate']);

    // Card — gate-card--no-wheelchair triggers a distinct CSS treatment
    const cardClass = [
      'gate-card',
      accessible ? 'gate-card--accessible' : 'gate-card--no-wheelchair',
    ].join(' ');

    const card = el('article', { class: cardClass, 'data-gate-id': gate.id }, [
      el('header', { class: 'gate-card__header' }, [
        el('h3', { class: 'gate-card__label' }, [gate.label ?? `Gate ${gate.id}`]),
        densityBadge,
      ]),
      el('div', { class: 'gate-card__zone' }, [`Zone: ${gate.zone}`]),
      el('div', { class: 'gate-card__stats' }, [
        el('span', { class: 'gate-stat' }, ['Wait: ', waitEl]),
        el('span', { class: 'gate-stat' }, [trendEl]),
      ]),
      accessEl,
    ]);

    container.appendChild(card);
  }
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
