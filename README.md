# StadiumOps Copilot — Premium Enterprise Edition

A serverless, AI-powered control-room dashboard for FIFA World Cup 2026 venue operators.

## Challenge Coverage Matrix

Our chosen vertical is Venue Operations & Crowd Safety for Tournament Organizers. The table below shows how each real operational need of this persona — routing, congestion, accessibility, transit, sustainability, translation, briefing, and live Q&A — is handled by one cohesive copilot, not as disconnected features.

| # | Focus Area | Feature / File |
|---|---|---|
| 1 | **Navigation & Wayfinding** | **Gate Recommend** (`/api/gate-recommend`) — evaluates all gates in real time and returns the single best gate with explicit routing reasons to optimize fan pathing. |
| 2 | **Crowd Management** | **Gate Grid** (`panels/gateGrid.js`) + **Live Signals** (`liveSignals.js`) — tracks real-time density, wait-time, and queue trend telemetry across 7 distinct matchday phases. |
| 3 | **Accessibility** | **Accessibility panel** (`panels/accessibility.js` + `/api/accessibility`) — ranks mobility and assistance requests by urgency to ensure priority dispatch and routing around non-accessible gates. |
| 4 | **Transportation** | **Status Bar** (`panels/statusBar.js`) — integrates transit carrier state and arrival timelines to coordinate crowd inflow with commuter schedules. |
| 5 | **Sustainability** | **KPI Strip** (`panels/kpiStrip.js`) — monitors waste diversion rates and water refill station availability to manage ecological impact under crowd pressure. |
| 6 | **Multilingual Assistance** | **Broadcast** (`panels/broadcast.js` + `/api/broadcast`) — translates digital signage announcements into up to 6 target languages simultaneously for international attendees. |
| 7 | **Operational Intelligence** | **Situation Briefing** (`panels/briefing.js` + `/api/briefing`) — synthesizes complex, multi-system telemetry into a cohesive 3-5 sentence brief for command staff. |
| 8 | **Real-time Decision Support** | **Decision Assistant** (`panels/assistant.js` + `/api/assistant`) — conversational workspace for operators to query current stadium signals and retrieve grounded operational decisions. |

## Vertical & Persona
**Persona**: Tournament Organizer / Venue Operations Staff
**Why**: Venue operators during mega-events like the World Cup need to process a high volume of rapidly changing telemetry (crowd density, wait times, weather, transit) to make split-second safety and routing decisions. They do not have time to synthesize raw data or write manual multi-lingual translations. This prototype gives them an intelligent "copilot" that instantly understands venue conditions and recommends actions, keeping fans safe and operations smooth.

## Approach & Logic

| Focus Area | Implementation |
|---|---|
| **PS1. Intelligent Recommendations** | **Gate Recommend**: Evaluates all stadium gates, factors in density/wait times/weather/transit, and returns the single best gate choice with explicit reasoning. |
| **PS2. Natural Language Generation** | **Broadcast**: Takes a short organizer message and generates plain-language English + multi-lingual (es, fr, ar, de, hi) translations for digital signage. |
| **PS3. Data Synthesis** | **Situation Briefing**: Consolidates 10+ signals (weather, transit status, gate densities, accessibility requests) into a concise 3-5 sentence operational summary. |
| **PS4. Conversational Interface** | **Decision Assistant**: A multi-turn chat interface where organizers can ask questions about venue state, with the AI maintaining context. |
| **PS5. Security and Guardrails** | Strict rate-limiting, CORS enforcement, zero `innerHTML` injection surface, structural JSON-mode validation, and untrusted input labeling in prompts. |
| **PS6. Handling Ambiguity** | **Accessibility**: Evaluates open accessibility requests and uses AI to rank them by urgency, generating context-aware suggested actions for staff to dispatch. |
| **PS7. Code Quality & Modularity** | Dependency-injected handlers, pure pure functions for state/validation, minimal pub-sub architecture without bloated external frameworks. |
| **PS8. Performance & Efficiency** | Caching of translations via a module-level Map, efficient client-side rendering (only re-rendering on state changes), and non-blocking PWA Service Worker shell caching. |
| **PS9. Enterprise UI/UX** | Mission-critical design using a refined 12-column CSS grid, Lucide SVG icons, subtle glassmorphism frost overlays, and responsive `.skeleton` loaders. |
| **PS10. Executive KPI Strip** | **Status Bar**: A top-level panel displaying real-time operational signals (Match Time, Weather conditions, and Transit status) to provide immediate situational awareness. |
| **PS11. Sustainability Metrics** | **KPI Strip + Live Signals**: Deterministic per-phase simulation of waste diversion rate (60–85%) and active water refill stations (up of 12), displayed as a live KPI card alongside the other operational metrics. |

## Project Structure

```
.
├── functions/             # Cloudflare Pages Functions (Backend API)
│   ├── _lib/              # Shared pure functions (gemini wrappers, rate limits, prompts)
│   └── api/               # Endpoint route handlers (e.g., accessibility.js, briefing.js)
├── public/                # Static Frontend (Vanilla JS, CSS, HTML)
│   ├── css/               # Enterprise SaaS styling (index.css)
│   ├── js/                # App logic
│   │   ├── panels/        # UI component logic (gateGrid, assistant, statusBar, etc.)
│   │   └── utils/         # DOM helpers, store, validators
│   └── index.html         # Main dashboard layout
├── tests/                 # 230 native node:test JSDOM tests covering both backend and frontend
├── .dev.vars              # Local development secrets (Not committed)
└── package.json           # Scripts and dependencies
```

## How It Works

The architecture relies on a Vanilla JS frontend (PWA) talking to Cloudflare Pages Functions (serverless API).

**Backend API Routes** (`/functions/api/`):
- `POST /api/briefing`: Reads live signals and prompts Gemini to return a concise situation report.
- `POST /api/assistant`: Maintains conversational history and answers operator questions grounded *strictly* in the live signals context.
- `POST /api/gate-recommend`: Evaluates all gates and picks the most optimal gate for a fan.
- `POST /api/broadcast`: Uses Gemini's JSON mode to translate an organizer message into multiple requested languages (caches identical requests to save tokens).
- `POST /api/accessibility`: Uses Gemini's JSON mode to analyze pending mobility/medical requests, ranking them by urgency and suggesting operational actions.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```
2. **Run Tests**
   ```bash
   npm test
   ```
3. **Configure Secrets**
   Create a `.dev.vars` file in the root directory:
   ```
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   This uses `wrangler pages dev` to serve the static frontend and the Cloudflare Functions locally.

## Security & Reliability

The following security constraints were rigorously implemented:
- **Zero-Injection UI**: The entire frontend is built using a custom `el()` DOM builder and `clearChildren()`. `innerHTML` is strictly prohibited and 0 instances exist in the codebase.
- **Rate Limiting**: Every API endpoint uses a sliding-window rate limit (default 10 requests / 60 seconds per IP) to prevent abuse and API quota exhaustion.
- **CORS Enforcement**: API endpoints reject cross-origin requests, ensuring they can only be called by the application itself.
- **Untrusted Input Labeling**: The AI prompts explicitly wrap user-provided text (like chat questions or broadcast messages) in `<untrusted_input>` blocks, instructing the model to treat it as data, not instruction.
- **Strict Validation**: All JSON payloads (both client-to-server and AI-to-server) are validated against exact shape and length constraints before processing. Hallucinated IDs are explicitly rejected with 502 errors.
- **Key Secrecy & 503 Guardrails**: The API key is securely managed via `.dev.vars` / Wrangler secrets and never exposed to the client bundle. The backend correctly validates missing keys and securely bubbles explicit configuration errors to the UI (preventing masked 503 errors).

## Testing

**Total Passing Tests: 230**
The test suite utilizes the native Node.js `node:test` runner and `jsdom`. It covers:
- **Backend**: API prompt construction, rate-limit logic, JSON validation logic, missing env variable guards, and mocked Gemini REST calls.
- **Frontend**: Store pub-sub mechanics, API wrappers, and JSDOM component rendering (ensuring UI logic, accessibility classes, and event listeners behave as expected under the new Enterprise class structure).

## Accessibility

- **Skip Link**: The main layout includes a `#main-content` anchor for keyboard navigation.
- **Aria-Live Regions**: The Assistant, Briefing, and Broadcast results use `aria-live="polite"` so screen readers announce incoming AI responses dynamically.
- **Language Attributes**: Generated translations explicitly set `lang="es"`, `lang="fr"`, etc., on their DOM nodes so assistive tech uses the correct pronunciation engine.
- **Semantic HTML & Contrast**: Proper use of `<main>`, `<article>`, `<header>`, and CSS custom properties tailored for high-contrast dark-mode legibility.
- **Reduced Motion**: CSS respects `@media (prefers-reduced-motion: reduce)` to disable transitions for users sensitive to motion.

## Assumptions & Limitations

- **Simulated Telemetry**: The "Live Signals" (gate wait times, weather, transit delays) are generated via a deterministic client-side simulation based on the `MATCH_START_MS` constant. In production, this would be a WebSocket or SSE feed from stadium IoT sensors.
- **Client-Side "Dispatch"**: The "Mark as dispatched" action in the Accessibility panel is a client-side prototype feature. It updates local state but does not persist to a backend database per the prototype's scoped boundaries.
- **Single-Session App**: There is no authentication or user session persistence.
- **In-Memory State**: The rate limiter and translation cache use module-level `Map` objects. On Cloudflare Pages, these exist per-isolate and will be cleared when the V8 isolate is spun down. Production would require Workers KV or Durable Objects for global consistency.
- **Gemini Model**: Defaults to `gemini-2.5-flash` unless overridden by the `GEMINI_MODEL` environment variable.

## Tech Stack

- Vanilla HTML / CSS / JavaScript (ES Modules)
- Cloudflare Pages Functions (Serverless backend)
- Google Gemini API (via REST fetch)
- `node:test` + `node:assert` + `jsdom` (Testing)
