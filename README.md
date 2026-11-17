# Roshan B Portfolio and AI Twin

A static portfolio for Roshan B with a grounded public knowledge base, an optional free-feed Live Shelf page, a Curiosity Lab, a playable 3D Neon Drift side quest, and an optional OpenRouter AI layer.

## What is included

- `index.html`: the portfolio, certificate wall, chat UI, Curiosity Lab entry point, a Neon Drift teaser, and a compact action nav that also opens the optional shelf. A small moon/sun control beside or above the nav adds a persisted daylight theme; dark remains the default.
- `game/`: a self-contained Three.js endless flyer at `game/index.html`. All geometry, labels, textures, and audio are generated in code; Three.js r170 is vendored locally, so the game needs no CDN or build step.
- `game/boot.js`: checks WebGL 2 and dynamically imports the engine. The main portfolio never downloads Three.js or opens a WebGL context.
- `game/config.js`: the tuning file for speed, difficulty, scoring, skills, spawning, and quality presets.
- `articles/index.html`: the optional standalone Live AI and Tech Shelf. It is reachable from the compact `AI Shelf` action in the top nav but stays out of the page flow so the portfolio remains the focus.
- `articles.js`: the shelf logic. It reads free, keyless Hacker News and DEV Community feeds, filters AI and tech, caches for 15 minutes, and falls back to a static reading list.
- `playground/`: the Curiosity Lab experiments, responsive styles, and a page-specific snowfall atmosphere with a pause control and reduced-motion support.
- `rag/`: the structured public knowledge source, BM25 retrieval engine, build validation, evaluation tests, and system prompt.
- `server.mjs`: a zero-dependency Node server that serves the portfolio and proxies `/api/chat` to OpenRouter.
- `api/status.json`: the static fallback status file. It keeps a static deployment on the local RAG path.
- `api/articles.json`: the static reading list used only when the live article feeds are unavailable.
- `.env.example`: environment variable template for the optional AI layer.

## Theme

The homepage defaults to the original dark theme. The moon/sun control outside the nav switches to a warm daylight theme, remembers the choice in `localStorage`, and animates the icon, background sun, and circular reveal. It respects reduced-motion preferences.

## Run the static portfolio

```powershell
python -m http.server 8765
```

Open `http://127.0.0.1:8765/`.

The static build uses lexical BM25 in the browser. It does not need a server, API key, embedding model, or vector database.

## Run with the optional AI layer

1. Copy `.env.example` to `.env`.
2. Set `OPENROUTER_API_KEY` to your own OpenRouter key.
3. Choose an `OPENROUTER_MODEL` available to your account. For Grok, use `x-ai/grok-4.7` or the current xAI model listed by OpenRouter.
4. Start the included server:

```powershell
npm start
```

Open `http://127.0.0.1:8765/`. The chat header changes to `OpenRouter · Grok · public notes` when the server reports that the AI layer is available.

Use an OpenRouter key for this path. A raw xAI key is not interchangeable with the OpenRouter endpoint. The model ID changes over time; check the OpenRouter model list before setting it.

Do not commit `.env` and do not put the key in `index.html`, client JavaScript, or a chat message. The browser calls `/api/chat`; the key stays in the server process.

The AI layer is inference, not training. It uses a system prompt with public-safe identity, voice calibration, and style details plus per-request retrieval of public notes. It does not learn from conversations or remember visitors. Private health, financial, family, relationship, precise-location, and academic-score details are not included in the public knowledge base.

## Optional Live Shelf

The Live Shelf is a separate page at `articles/index.html`, linked from the `AI Shelf` action in the top nav. It is separate from the numbered section links and does not load on the main portfolio page. That keeps the portfolio focused on Roshan and makes the shelf an opt-in side experience.

It is client-side and needs no API key or server. It reads two free public sources:

- Hacker News through the Algolia API, filtered to recent stories with at least 20 points.
- DEV Community through its public articles API.

Results are deduplicated, sorted by date, filtered by AI or Tech, and cached in `localStorage` for 15 minutes. The Refresh button bypasses the cache. If the feeds are blocked or offline, the page loads `api/articles.json`, a bundled static reading list. The source links remain available even when both paths fail.

The shelf is a public side page, not a personal reading log. The AI twin can explain where it lives and where the links come from, but it does not claim that Roshan has read every item.

To update the fallback list, edit `api/articles.json`. No build step is required.

## Neon Drift

`game/index.html` is a separate, playable 3D endless flyer. It is linked from the homepage **Game** section and the top `Game` action beside Lab and the notes chat. The homepage teaser uses a small 2D canvas preview and never loads Three.js; only the game page imports the engine.

Open `http://127.0.0.1:8765/game/index.html` after starting the static server or `npm start`.

Controls:

- `WASD` / arrow keys or drag: steer.
- `Space` / on-screen shield button: deploy a collected shield charge.
- `Esc` / `P`: pause and resume.
- Gamepad: left stick or D-pad steers, A/RB deploys a shield, Start pauses.

Collect labeled skill orbs, chain pickups within 3.2 seconds to raise the multiplier, skim gates and bars for near-miss points, and grab green power-ups for shields. Best score, run count, mute preference, and quality preference are stored under the `neon-drift:*` `localStorage` keys.

The game auto-pauses when the tab is hidden or the window loses focus, respects `prefers-reduced-motion`, disposes Three.js resources on `pagehide`, and shows a readable fallback when WebGL 2 is unavailable.

To tune the game, edit `game/config.js` (speed curve, spawn cadence, gate patterns, skill labels, and quality presets). The renderer, post-processing, and resize behavior live in `game/engine.js`; high quality adds bloom-style blur, chromatic aberration, grain, and a denser starfield. A low-quality auto-preset is chosen for small screens or low-core devices.

## Update the knowledge base

Edit `rag/source/public.json`, then run:

```powershell
node rag/build.mjs
node rag/eval.mjs
```

`rag/build.mjs` validates the source and regenerates `rag/knowledge-public.js`. Do not edit the generated bundle by hand. Private entries must stay outside `rag/source/public.json`.

## Tests

```powershell
node rag/eval.mjs
node rag/server-test.mjs
```

The RAG suite covers retrieval, modes, follow-ups, privacy, unknown preferences, evidence metadata, and historical filtering. The server suite uses a local mock OpenRouter endpoint and covers grounding, privacy short-circuiting, rate limiting, request limits, missing keys, upstream failure fallback, and static denial of secrets.

## Deployment

For the static fallback, deploy `index.html`, the `articles/` folder, `articles.js`, `rag/knowledge-public.js`, `rag/rag-core.js`, `api/status.json`, `api/articles.json`, the `playground/` folder, and the `game/` folder (including its vendored `game/vendor/three.module.min.js`) to any static host. The game must be served over HTTP rather than opened directly from disk because it uses ES modules. The optional Live Shelf works on GitHub Pages because it calls free public feeds directly and needs no secret.

For the AI layer, deploy the repository to a Node host, set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in the host environment, and set `HOST=0.0.0.0` if required. A static-only host cannot keep an API key secret.

See `rag/README.md` for the full schema, privacy boundary, update workflow, and limitations.
