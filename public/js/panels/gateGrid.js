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
export function renderGateGrid(container, signals) {
  clearChildren(container);

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
    // Gate C (and any future non-accessible gate) gets a visually distinct
    // warning element, not just a subtle missing icon.
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
 * subsequent state update. The store's state is expected to have a `signals`
 * property containing the LiveSignals object.
 *
 * @param {HTMLElement}                         container - DOM node to render into.
 * @param {{ getState: Function, subscribe: Function }} store - App state store.
 * @returns {Function} Unsubscribe function — call to detach this panel.
 */
export function mountGateGrid(container, store) {
  const render = (state) => {
    renderGateGrid(container, state.signals ?? null);
  };

  // Render once immediately with current state
  render(store.getState());

  // Subscribe to future state changes
  return store.subscribe(render);
}
