/**
 * @file kpiStrip.js
 * Renders the Executive KPI Strip (Attendance, Weather, Incidents, Gates).
 */

import { el, clearChildren, refreshIcons } from '../utils/dom.js';

export function renderKpiStrip(container, signals) {
  clearChildren(container);

  if (!signals) return;

  const { match, weather, gates, accessibilityRequests } = signals;

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

  // Append all
  container.appendChild(attCard);
  container.appendChild(weatherCard);
  container.appendChild(gateCard);
  container.appendChild(accessCard);

  // Re-run lucide for newly added icons
  refreshIcons();
}

export function mountKpiStrip(container, store) {
  const render = (state) => {
    renderKpiStrip(container, state.signals ?? null);
  };

  render(store.getState());
  return store.subscribe(render);
}
