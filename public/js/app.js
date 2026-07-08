/**
 * @file app.js
 * Main bootstrap script for StadiumOps Copilot control-room UI.
 */

import { createStore } from './state.js';
import * as api from './api.js';
import { generateLiveSignals } from './liveSignals.js';
import { clearChildren } from './utils/dom.js';

import { mountGateGrid } from './panels/gateGrid.js';
import { mountBriefingPanel } from './panels/briefing.js';
import { mountAssistantPanel } from './panels/assistant.js';
import { mountBroadcastPanel } from './panels/broadcast.js';
import { mountAccessibilityPanel } from './panels/accessibility.js';

// Fixed match start time for prototype demo (30 mins from first load, to keep it in "pre-match" or "first-half")
const MATCH_START_MS = Date.now() + 30 * 60 * 1000;

async function bootstrap() {
  try {
    // 1. Create centralized state store
    const store = createStore({ signals: null });

    // 2. Start LiveSignals generator loop (efficiency goal: 8-10 seconds)
    const updateSignals = () => {
      const signals = generateLiveSignals(Date.now(), MATCH_START_MS);
      store.setState({ signals });
    };
    
    // Initial fetch and set interval (every 8 seconds)
    updateSignals();
    setInterval(updateSignals, 8000);

    // 3. Mount all UI panels
    const gateGridContainer = document.getElementById('panel-gates');
    if (gateGridContainer) {
      mountGateGrid(gateGridContainer, store);
    }

    const briefingContainer = document.getElementById('panel-briefing');
    if (briefingContainer) {
      mountBriefingPanel(briefingContainer, api);
    }

    const assistantContainer = document.getElementById('panel-assistant');
    if (assistantContainer) {
      mountAssistantPanel(assistantContainer, api);
    }

    const broadcastContainer = document.getElementById('panel-broadcast');
    if (broadcastContainer) {
      mountBroadcastPanel(broadcastContainer, api);
    }

    const accessibilityContainer = document.getElementById('panel-accessibility');
    if (accessibilityContainer) {
      mountAccessibilityPanel(accessibilityContainer, api);
    }

    // 4. Register Service Worker for PWA (Cache-first for shell, Network-first for /api)
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
