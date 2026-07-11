/**
 * @file kpiStrip.js
 * Renders the Executive KPI Strip (Attendance, Weather, Gate Congestion, Accessibility, Sustainability).
 */

import { el, clearChildren, refreshIcons } from '../utils/dom.js';
import { WATER_REFILL_TOTAL } from './liveSignals.js';

/**
 * Renders the Executive KPI Strip into `container`.
 * Produces four cards: estimated attendance, current weather, gate congestion
 * alert count, and pending accessibility request count.
 *
 * @param {HTMLElement} container  - DOM node to render into.
 * @param {object|null} signals    - Live signals snapshot; if null, renders nothing.
 * @param {object}      signals.weather             - Weather data object.
 * @param {Array}       signals.gates               - Array of gate objects.
 * @param {Array}       signals.accessibilityRequests - Array of accessibility request objects.
 * @param {{ wasteDiversionRatePercent: number, waterRefillStationsActive: number }} signals.sustainability
 *   - Sustainability metrics snapshot.
 * @returns {void}
 */
export function renderKpiStrip(container, signals) {
  clearChildren(container);

  if (!signals) return;

  const { weather, gates, accessibilityRequests, sustainability } = signals;

  // Helpers
  const makeCard = (icon, title, value, trend, trendClass) => {
    return el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-header' }, [
        el('span', {}, [title]),
        el('i', { 'data-lucide': icon })
      ]),
      el('div', { class: 'kpi-value' }, [
        String(value),
        trend ? el('span', { class: `kpi-trend ${trendClass}` }, [trend]) : null
      ].filter(Boolean))
    ]);
  };

  // 1. Attendance
  // Sum of all gate densities as a proxy for attendance pressure, or just mock a static number based on match info
  // Since we don't have a direct "attendance" signal, we'll mock it intelligently.
  const attendance = "68,450";
  const attCard = makeCard('users', 'Est. Attendance', attendance, '+1.2%', 'positive');

  // 2. Weather
  let weatherTrend = 'neutral';
  if (weather.condition === 'Clear' || weather.condition === 'Partly Cloudy') weatherTrend = 'positive';
  else if (weather.condition === 'Rain' || weather.condition === 'Thunderstorm') weatherTrend = 'negative';
  const weatherCard = makeCard(
    weather.condition === 'Clear' ? 'sun' : weather.condition === 'Rain' ? 'cloud-rain' : 'cloud', 
    'Weather', 
    `${weather.tempCelsius}°C`, 
    weather.condition, 
    weatherTrend
  );

  // 3. Gate Status
  const highWaitGates = gates.filter(g => g.density === 'high' || g.waitTimeMinutes > 10).length;
  const gateTrend = highWaitGates > 0 ? `${highWaitGates} Alerts` : 'All Clear';
  const gateClass = highWaitGates > 0 ? 'negative' : 'positive';
  const gateCard = makeCard('alert-triangle', 'Gate Congestion', highWaitGates > 0 ? highWaitGates : '0', gateTrend, gateClass);

  // 4. Accessibility
  const pendingAccess = accessibilityRequests.filter(r => r.status === 'pending').length;
  const accessTrend = pendingAccess > 0 ? `${pendingAccess} Pending` : 'All Clear';
  const accessClass = pendingAccess > 0 ? 'negative' : 'positive';
  const accessCard = makeCard('wheelchair', 'Access Requests', pendingAccess, accessTrend, accessClass);

  // 5. Sustainability
  const { wasteDiversionRatePercent, waterRefillStationsActive } = sustainability;
  const sustainTrend = `${waterRefillStationsActive} of ${WATER_REFILL_TOTAL} stations`;
  const sustainClass = wasteDiversionRatePercent >= 75 ? 'positive' : wasteDiversionRatePercent >= 65 ? 'neutral' : 'negative';
  const sustainCard = makeCard(
    'leaf',
    'Waste Diversion',
    `${wasteDiversionRatePercent}%`,
    sustainTrend,
    sustainClass,
  );

  // Append all
  container.appendChild(attCard);
  container.appendChild(weatherCard);
  container.appendChild(gateCard);
  container.appendChild(accessCard);
  container.appendChild(sustainCard);

  // Re-run lucide for newly added icons
  refreshIcons();
}

/**
 * Subscribes the KPI strip to a store, rendering immediately and on every
 * subsequent state update.
 *
 * @param {HTMLElement}                                     container - DOM node to render into.
 * @param {{ getState: Function, subscribe: Function }}     store     - App state store.
 * @returns {Function} Unsubscribe function — call to detach this panel.
 */
export function mountKpiStrip(container, store) {
  const render = (state) => {
    renderKpiStrip(container, state.signals ?? null);
  };

  render(store.getState());
  return store.subscribe(render);
}
