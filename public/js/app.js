/**
 * @file app.js
 * Main bootstrap script for StadiumOps Copilot control-room UI.
 */

import { createStore } from './state.js';
import * as api from './api.js';
import { generateLiveSignals } from './liveSignals.js';
import { clearChildren } from './utils/dom.js';

import { mountGateGrid } from './panels/gateGrid.js';
import { mountStatusBar } from './panels/statusBar.js';
import { mountBriefingPanel } from './panels/briefing.js';
import { mountAssistantPanel } from './panels/assistant.js';
import { mountBroadcastPanel } from './panels/broadcast.js';
import { mountAccessibilityPanel } from './panels/accessibility.js';
import { SIGNALS_REFRESH_INTERVAL_MS, MATCH_START_OFFSET_MS } from './constants.js';

// Fixed match start time for prototype demo (30 mins from first load, to keep it in "pre-match" or "first-half")
const MATCH_START_MS = Date.now() + MATCH_START_OFFSET_MS;

async function bootstrap() {
  try {
    // --- State & Live Signals ---
    const store = createStore({ signals: null });

    const updateSignals = () => {
      const signals = generateLiveSignals(Date.now(), MATCH_START_MS);
      store.setState({ signals });
    };

    // Initial fetch and set interval (every 8 seconds)
    updateSignals();
    setInterval(updateSignals, SIGNALS_REFRESH_INTERVAL_MS);

    // --- Panel Mounting ---
    // Each entry maps a DOM element id to a mount function (closed over store or api as needed).
    // kpiStrip uses a dynamic import to avoid breaking tests if the file is not yet implemented.
    const panels = [
      {
        id: 'panel-kpi',
        mount: (el) => {
          // Dynamic import to avoid missing files breaking tests if not fully implemented yet
          import('./panels/kpiStrip.js').then(({ mountKpiStrip }) => {
            mountKpiStrip(el, store);
          });
        },
      },
      { id: 'panel-status',        mount: (el) => mountStatusBar(el, store)        },
      { id: 'panel-gates',         mount: (el) => mountGateGrid(el, store)         },
      { id: 'panel-briefing',      mount: (el) => mountBriefingPanel(el, api)      },
      { id: 'panel-assistant',     mount: (el) => mountAssistantPanel(el, api)     },
      { id: 'panel-broadcast',     mount: (el) => mountBroadcastPanel(el, api)     },
      { id: 'panel-accessibility', mount: (el) => mountAccessibilityPanel(el, api) },
    ];

    panels.forEach(({ id, mount }) => {
      const el = document.getElementById(id);
      if (el) mount(el);
    });

    // --- Command Palette ---
    const paletteOverlay = document.getElementById('command-palette');
    const paletteInput = document.getElementById('palette-input');
    const btnSearch = document.getElementById('btn-search');

    const togglePalette = (show) => {
      if (!paletteOverlay) return;
      if (show) {
        paletteOverlay.classList.remove('hidden');
        paletteOverlay.setAttribute('aria-hidden', 'false');
        if (paletteInput) paletteInput.focus();
      } else {
        paletteOverlay.classList.add('hidden');
        paletteOverlay.setAttribute('aria-hidden', 'true');
        if (paletteInput) paletteInput.blur();
      }
    };

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        togglePalette(paletteOverlay?.classList.contains('hidden'));
      }
      if (e.key === 'Escape') {
        togglePalette(false);
      }
    });

    if (btnSearch) {
      btnSearch.addEventListener('click', () => togglePalette(true));
    }
    if (paletteOverlay) {
      paletteOverlay.addEventListener('click', (e) => {
        if (e.target === paletteOverlay) togglePalette(false);
      });
    }

    // --- Service Worker (PWA) ---
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('Service Worker registration failed:', err);
        });
      });
    }

  } catch (err) {
    console.error('Fatal initialization error:', err);
    
    // Render visible top-level error rather than failing silently
    const root = document.body;
    clearChildren(root); // P0 requirement: never use innerHTML
    
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'fatal-error-overlay';
    errorOverlay.style.padding = '2rem';
    errorOverlay.style.color = '#ef4444';
    errorOverlay.style.fontFamily = 'system-ui, sans-serif';
    
    const heading = document.createElement('h1');
    heading.textContent = 'Application Failed to Start';
    
    const details = document.createElement('pre');
    details.textContent = err.message || err.toString();
    details.style.background = '#fee2e2';
    details.style.padding = '1rem';
    details.style.borderRadius = '4px';
    
    errorOverlay.appendChild(heading);
    errorOverlay.appendChild(details);
    root.appendChild(errorOverlay);
  }
}

// Start app
bootstrap();
