# Roshan B Portfolio and AI Twin

A static portfolio for Roshan B with a grounded public knowledge base, a Curiosity Lab, and an optional OpenRouter AI layer.

## What is included

- `index.html`: the portfolio, certificate wall, chat UI, and Curiosity Lab entry point.
- `playground/`: the Curiosity Lab experiments and responsive styles.
- `rag/`: the structured public knowledge source, BM25 retrieval engine, build validation, evaluation tests, and system prompt.
- `server.mjs`: a zero-dependency Node server that serves the portfolio and proxies `/api/chat` to OpenRouter.
- `api/status.json`: the static fallback status file. It keeps a static deployment on the local RAG path.
- `.env.example`: environment variable template for the optional AI layer.

## Run the static portfolio

```powershell
python -m http.server 8765
```

Open `http://127.0.0.1:8765/`.

The static build uses lexical BM25 in the browser. It does not need a server, API key, embedding model, or vector database.

## Run with the optional AI layer

1. Copy `.env.example` to `.env`.
2. Set `OPENROUTER_API_KEY` to your own OpenRouter key.
3. Choose an `OPENROUTER_MODEL` available to your account.
4. Start the included server:

```powershell
npm start
```

Open `http://127.0.0.1:8765/`. The chat header changes to `OpenRouter · grounded public notes` when the server reports that the AI layer is available.

Do not commit `.env` and do not put the key in `index.html`, client JavaScript, or a chat message. The browser calls `/api/chat`; the key stays in the server process.

The AI layer is inference, not training. It uses a system prompt with public-safe identity and style details plus per-request retrieval of public notes. It does not learn from conversations or remember visitors. Private health, financial, family, relationship, precise-location, and academic-score details are not included in the public knowledge base.

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

For the static fallback, deploy `index.html`, `rag/knowledge-public.js`, `rag/rag-core.js`, `api/status.json`, and the `playground/` folder to any static host.

For the AI layer, deploy the repository to a Node host, set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in the host environment, and set `HOST=0.0.0.0` if required. A static-only host cannot keep an API key secret.

See `rag/README.md` for the full schema, privacy boundary, update workflow, and limitations.
