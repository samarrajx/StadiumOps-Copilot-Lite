/**
 * @file statusBar.js
 * Status Bar panel for the StadiumOps Copilot control-room UI.
 * Renders match info, weather, and transit state from the simulator.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren } from '../utils/dom.js';

// ---------------------------------------------------------------------------
// renderStatusBar
// ---------------------------------------------------------------------------

/**
 * Renders the top status bar.
 *
 * @param {HTMLElement} container
 * @param {object|null} signals
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
    el('div', { class: 'status-card__header' }, ['Match Information']),
    el('div', { class: 'match-teams' }, [matchTeamText]),
    el('div', { class: 'match-stage text-muted' }, [matchStageText]),
    el('div', { class: 'match-status-badge' }, [matchStatusText]),
  ]);

  // --- Weather Info ---
  const conditionText = weather.condition ?? 'Unknown Condition';
  const tempText = weather.tempCelsius !== undefined ? `${weather.tempCelsius}°C` : '--°C';
  
  const weatherChildren = [
    el('div', { class: 'status-card__header' }, ['Weather']),
    el('div', { class: 'weather-main' }, [`${conditionText}, ${tempText}`]),
  ];
  
  if (weather.advisory) {
    weatherChildren.push(
      el('div', { class: 'weather-advisory' }, [
        el('strong', {}, ['Advisory: ']), 
        weather.advisory
      ])
    );
  }

  const weatherCard = el('div', { class: 'status-card weather-card' }, weatherChildren);

  // --- Transit Info ---
  const transitList = el('div', { class: 'transit-list' }, []);
  
  for (const line of transit) {
    let stateClass = '';
    if (line.state === 'on-time') stateClass = 'transit-state--on-time';
    else if (line.state === 'delayed') stateClass = 'transit-state--delayed';
    else if (line.state === 'disrupted') stateClass = 'transit-state--disrupted';

    const item = el('div', { class: 'transit-item' }, [
      el('div', { class: 'transit-name' }, [
        el('strong', {}, [line.name ?? 'Unknown Line']),
        el('span', { class: 'text-muted' }, [` (${line.mode ?? 'unknown'})`])
      ]),
      el('div', { class: 'transit-status' }, [
        el('span', { class: `transit-state-badge ${stateClass}` }, [line.state ? line.state.toUpperCase() : 'UNKNOWN']),
        el('span', { class: 'transit-eta text-muted' }, [`ETA: ${line.etaMinutes !== undefined ? line.etaMinutes + 'm' : '--'}`])
      ])
    ]);
    transitList.appendChild(item);
  }

  const transitCard = el('div', { class: 'status-card transit-card' }, [
    el('div', { class: 'status-card__header' }, ['Transit Updates']),
    transitList
  ]);

  // Combine into layout
  const grid = el('div', { class: 'status-bar-grid' }, [
    matchCard,
    weatherCard,
    transitCard
  ]);

  container.appendChild(grid);
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
