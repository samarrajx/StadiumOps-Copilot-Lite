/**
 * @file statusBar.js
 * Status Bar panel for the StadiumOps Copilot control-room UI.
 * Renders match info, weather, and transit state from the simulator.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren, refreshIcons } from '../utils/dom.js';

// ---------------------------------------------------------------------------
// renderStatusBar
// ---------------------------------------------------------------------------

/**
 * Renders match information, weather, and transit status into `container`.
 * Clears existing children on each call — safe to call repeatedly.
 *
 * @param {HTMLElement} container      - DOM node to render into.
 * @param {object|null} signals        - Live signals snapshot; if null, renders nothing.
 * @param {object}      signals.match  - Match metadata (homeTeam, awayTeam, matchStatus, …).
 * @param {object}      signals.weather - Weather data (condition, tempCelsius, advisory).
 * @param {Array}       signals.transit - Array of transit line objects.
 * @returns {void}
 */
export function renderStatusBar(container, signals) {
  clearChildren(container);

  if (!signals) return;

  const match = signals.match ?? {};
  const weather = signals.weather ?? {};
  const transit = signals.transit ?? [];

  // --- Match Info ---
  const matchTeamText = (match.homeTeam && match.awayTeam)
    ? `${match.homeTeam} vs ${match.awayTeam}`
    : 'Unknown Match';
  const matchStageText = match.competitionStage ?? 'Unknown Stage';
  const matchStatusText = match.matchStatus ? match.matchStatus.toUpperCase() : 'UNKNOWN STATUS';

  const matchCard = el('div', { class: 'status-card match-card' }, [
    el('div', { class: 'status-card__header' }, [
      el('span', {}, ['Match Information']),
      el('i', { 'data-lucide': 'trophy' })
    ]),
    el('div', { class: 'match-teams font-bold text-lg mt-2' }, [matchTeamText]),
    el('div', { class: 'match-stage text-muted text-sm mb-2' }, [matchStageText]),
    el('span', { class: 'badge badge-info' }, [matchStatusText]),
  ]);

  // --- Weather Info ---
  const conditionText = weather.condition ?? 'Unknown Condition';
  const tempText = weather.tempCelsius !== undefined ? `${weather.tempCelsius}°C` : '--°C';
  
  const weatherChildren = [
    el('div', { class: 'status-card__header' }, [
      el('span', {}, ['Live Weather']),
      el('i', { 'data-lucide': 'cloud' })
    ]),
    el('div', { class: 'weather-main font-bold text-lg mt-2' }, [`${tempText} — ${conditionText}`]),
  ];
  
  if (weather.advisory) {
    weatherChildren.push(
      el('div', { class: 'weather-advisory mt-2' }, [
        el('span', { class: 'badge badge-high' }, ['Advisory']), 
        el('span', { class: 'text-sm ml-2 text-muted' }, [weather.advisory])
      ])
    );
  }

  const weatherCard = el('div', { class: 'status-card weather-card' }, weatherChildren);

  // --- Transit Info ---
  const transitList = el('div', { class: 'transit-list mt-2 flex flex-col gap-2' }, []);
  
  for (const line of transit) {
    let stateClass = 'badge-outline';
    if (line.state === 'on-time') stateClass = 'badge-low';
    else if (line.state === 'delayed') stateClass = 'badge-medium';
    else if (line.state === 'disrupted') stateClass = 'badge-high';

    const item = el('div', { class: 'transit-item flex justify-between items-center p-2 border border-light rounded' }, [
      el('div', { class: 'transit-name flex flex-col' }, [
        el('strong', { class: 'text-sm' }, [line.name ?? 'Unknown Line']),
        el('span', { class: 'text-muted text-xs' }, [line.mode ?? 'unknown'])
      ]),
      el('div', { class: 'transit-status flex flex-col items-end' }, [
        el('span', { class: `badge ${stateClass} mb-1` }, [line.state ? line.state.toUpperCase() : 'UNKNOWN']),
        el('span', { class: 'transit-eta text-muted text-xs' }, [`ETA: ${line.etaMinutes !== undefined ? line.etaMinutes + 'm' : '--'}`])
      ])
    ]);
    transitList.appendChild(item);
  }

  const transitCard = el('div', { class: 'status-card transit-card' }, [
    el('div', { class: 'status-card__header' }, [
      el('span', {}, ['Transit Networks']),
      el('i', { 'data-lucide': 'train' })
    ]),
    transitList
  ]);

  // Combine into layout
  const grid = el('div', { class: 'status-bar-grid' }, [
    matchCard,
    weatherCard,
    transitCard
  ]);

  container.appendChild(grid);
  refreshIcons();
}

// ---------------------------------------------------------------------------
// mountStatusBar
// ---------------------------------------------------------------------------

/**
 * Subscribes to the app store and re-renders the status bar.
 *
 * @param {HTMLElement} container
 * @param {object} store
 * @returns {Function} Unsubscribe function
 */
export function mountStatusBar(container, store) {
  const render = (state) => {
    renderStatusBar(container, state.signals ?? null);
  };

  render(store.getState());
  return store.subscribe(render);
}
