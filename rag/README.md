# Public RAG and optional AI layer

This folder contains the structured public knowledge bundle, the browser retrieval engine, and the optional OpenRouter proxy used by the portfolio chat.

## Audit summary

The portfolio is a static single-page site. Before this upgrade, the chat used one inline `NOTES` array and a small BM25 function inside `index.html`. It had a privacy regex, but no structured metadata, no evidence labels, no update workflow, no evaluation set, and no public/private build boundary.

The upgraded system keeps the static fallback and adds:

- A structured source file with evidence, status, sensitivity, and recency metadata.
- A build step that validates the source and writes a public-only browser bundle.
- A separate retrieval engine with query classification, mode filters, a privacy guard, follow-up context, and evidence labels.
- A mode selector for portfolio, technical, personal, interview, and learning answers.
- An evaluation script that checks retrieval, privacy, unknown information, modes, and historical records.
- An optional server-side OpenRouter layer that phrases the same retrieved public notes. The API key stays on the server.

Without a server, the portfolio remains fully static and uses lexical BM25 in the browser. There is no backend, no LLM, no embedding model, and no vector database in that mode. With `server.mjs` and an OpenRouter key, the server retrieves the same public notes and asks a model to phrase the answer. The model is not trained on the portfolio; it is conditioned by the system prompt and the retrieved notes for each request.

## Files

- `source/public.json`: the editable public knowledge source.
- `build.mjs`: validates the source and generates `knowledge-public.js`.
- `knowledge-public.js`: generated browser bundle. Do not edit by hand.
- `rag-core.js`: browser and Node compatible retrieval engine.
- `eval.mjs`: evaluation and privacy tests.
- `server-test.mjs`: proxy, privacy, rate-limit, and static-denial tests.
- `SYSTEM_PROMPT.md`: the system prompt loaded by `server.mjs`. It is not executed by the static fallback.
- `source/private.example.json`: schema example only. It is not loaded by the site.
- `../server.mjs`: optional zero-dependency Node server that serves the site and proxies `/api/chat`.
- `../api/status.json`: static fallback status file that keeps a static deployment on the local RAG path.
- `../.env.example`: environment variable template for the optional AI layer.
- `../package.json`: convenience scripts for the server, build, and tests.

## Local setup

For the static fallback, serve the folder with any static server:

```powershell
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/`.

For the optional AI layer, copy `.env.example` to `.env`, add your real `OPENROUTER_API_KEY`, choose an `OPENROUTER_MODEL`, and start the included server:

```powershell
Copy-Item .env.example .env
# Edit .env and set OPENROUTER_API_KEY.
npm start
```

Then open `http://127.0.0.1:8765/`. The header changes to `OpenRouter · grounded public notes` when the server reports that the AI layer is available. If the key is missing or the upstream call fails, the browser falls back to the local RAG answer.

The server, build, and test scripts use Node built-ins only, so no `npm install` is required. Node 18 or newer is recommended. Never paste the key into `index.html`, client JavaScript, a chat message, or a public repository. If you add certificates, keep `CERT_COUNT` in `.env` aligned with `CERTS.length` in `index.html`.

## Update workflow

1. Edit `rag/source/public.json`.
2. Run `node rag/build.mjs`.
3. Run `node rag/eval.mjs`.
4. Run `node rag/server-test.mjs` if you changed the server.
5. Restart `server.mjs` if you changed the system prompt, then test the chat in a browser.

The build fails if an entry has a missing field, an unknown category, a duplicate id, an unsafe sensitivity, a private entry in the public source, an em dash or en dash, or a spaced double hyphen. Private entries must stay outside `source/public.json`, because the source file itself may be deployed.

## Training versus conditioning

An OpenRouter key is an inference credential. It does not train a model on the portfolio. The integration uses two mechanisms instead:

1. A system prompt with public-safe identity, style, evidence, and privacy rules.
2. Per-request retrieval of relevant public notes, appended as context.

That is enough to make the model sound like a grounded portfolio twin. It is not fine-tuning, and the model does not remember a visitor between requests. Fine-tuning would require a separate training dataset, a fine-tuning-capable provider, and an evaluation process for forgetting, privacy leakage, and stale facts.

## Entry schema

Each entry is merged with the top-level defaults, so an entry only needs to override fields that differ.

Required fields after the merge:

- `id`: stable unique identifier.
- `title`: source label shown in the chat.
- `category`: one of `identity`, `education`, `career`, `experience`, `projects`, `skills`, `learning`, `interests`, `contact`, `meta`, or `preferences`.
- `subcategory`: optional narrower label.
- `sec`: portfolio section to jump to.
- `kw`: keyword string used by BM25.
- `retrieval_tags`: array of short retrieval tags.
- `text`: the answer text. Use `{{CERTS_COUNT}}` for the live certificate count.
- `next`: array of follow-up questions, maximum four.
- `source`: human-readable provenance.
- `source_type`: `curated_note` or `reference`.
- `evidence_type`: `user_confirmed`, `user_reported_event`, `historical_record`, `assistant_inference`, `unverified_claim`, `unknown`, or `reference`.
- `created_at` and `updated_at`: ISO date strings.
- `event_date`: optional date or date range for when the event happened.
- `valid_from` and `valid_until`: optional validity window for time-sensitive facts.
- `status`: `current`, `historical`, `exploratory`, `unknown`, `completed`, `prototype`, or `archived`.
- `confidence`: `high`, `medium`, or `low`.
- `sensitivity`: `public`, `low`, or `private`. Private is rejected in `source/public.json` and belongs in a server-side store.
- `is_current`: boolean. Entries with `false` are excluded from ordinary retrieval and only appear for historical queries.
- `supersedes`: optional id of an older entry. Keep the older entry as `is_current: false` with a historical status instead of deleting it.
- `public`: boolean. Must be `true` in `source/public.json`; a private or `false` entry causes the build to fail.
- `related_entities`: array of names or concepts.

## Evidence labels

The chat shows a label next to each source:

- `confirmed`: directly supplied or recorded.
- `reported`: a user-reported event or summarized experience.
- `historical`: a past record that may no longer be current.
- `inference`: a cautious interpretation, not a confirmed fact.
- `unverified`: a claim that needs confirmation.
- `unknown`: the available records do not establish the answer.
- `reference`: standard technical or implementation material.

Hovering a source chip also shows its provenance, category, status, confidence, and last-updated date.

Do not turn an inference into a confirmed memory. Do not present an unknown favorite film, singer, game, or book as a real preference.

## Privacy boundary

Only `public` and `low` sensitivity entries are allowed in `source/public.json` and included in `knowledge-public.js`. The build fails if it finds a private entry or `public: false` in the public source, because the source file itself may be deployed. The private example file is not read by the build, is not loaded by the page, and is denied by the server.

The runtime privacy guard blocks requests for health, finances, family, relationships, exact location, academic scores, and similar personal details. It returns a generic boundary answer instead of confirming or denying a specific detail.

The optional AI layer receives only the user's question and retrieved public notes. The privacy guard runs before the model call, so private questions and unknown preference questions are answered locally and are not sent to OpenRouter. OpenRouter and the selected model provider still receive the public notes and the user's question, so do not put private data in `public.json`.

The API key stays in the server process environment. It is never included in the HTML, the browser bundle, or the `/api/status` response. This is not a secure owner-only mode: any visitor can ask the public twin a question. Rate limiting reduces casual abuse but is not authentication.

This site cannot provide a secure owner-only mode without server-side authentication. Any private data placed in a frontend bundle can be downloaded by a visitor. If you need private personal-twin answers, add a server-side authenticated endpoint, keep private records on the server, and never ship them in `knowledge-public.js` or `public.json`.

## Modes

- `Auto`: classifies the question and selects a mode.
- `Portfolio`: professional and recruiter-friendly context.
- `Technical`: projects, implementation, skills, and technical explanations.
- `Personal`: safe public context about learning, communication, career trade-offs, interests, and preferences.
- `Interview`: generates a practice question or appends a likely follow-up to a project answer.
- `Learning`: intuition-first explanations such as the Bayes theorem and BM25 notes.

Mode filters are soft. If a mode has no relevant entry, retrieval falls back to the public bundle so the chat does not dead-end. With the AI layer enabled, the selected mode is also passed to the system prompt; retrieval still uses the same filters.

## Evaluation

Run:

```powershell
node rag/eval.mjs
```

The suite checks professional answers, technical answers, personal context, mode behavior, follow-up context, privacy blocking, unknown preferences, non-current record filtering, and source metadata.

Run the proxy tests with:

```powershell
node rag/server-test.mjs
```

Those tests use a local mock OpenRouter endpoint, so they do not need a real key. They check status reporting, grounded context, privacy short-circuiting, unknown-preference short-circuiting, follow-up sources, request-size limits, rate limiting, missing-key behavior, upstream failure fallback, and static denial of `.env`, `server.mjs`, the system prompt, and private example files.

## Deployment

For the static fallback, upload `index.html`, `rag/knowledge-public.js`, `rag/rag-core.js`, and `api/status.json`. The status file tells the browser to stay on the local RAG path. The public source JSON and build scripts can also be deployed because the build rejects private entries in the public source. Keep any private source file outside the deployed folder.

For the AI layer, deploy the whole folder to a Node host such as Render, Railway, Fly.io, or a VPS, set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in the host's environment settings, and set `HOST=0.0.0.0` if the host requires it. Set `PUBLIC_SITE_URL` to the deployed URL. Do not commit `.env` or deploy it as a static asset. A static-only host such as GitHub Pages cannot keep an OpenRouter key secret, so use the local fallback there.

No environment variables are required for static-only mode. The optional AI mode requires the variables in `.env.example`; there is no API key in the browser bundle.

## Remaining limitations

- Retrieval is lexical BM25, not semantic embedding search. Synonyms are handled with a small curated map.
- Static answers are curated notes. AI answers are generated prose grounded in those notes, so the model can still phrase something imperfectly.
- The AI layer is persona conditioning plus retrieval, not fine-tuning or training. The model does not learn from conversations.
- There is no authenticated private mode. The public AI can be asked by any visitor.
- There is no automatic PDF or document ingestion. Updates are manual JSON edits followed by the build.
- Source freshness depends on manual `updated_at` and `is_current` maintenance.
- The chat does not log queries or retrieved passages. Server errors are logged without the key or user question.
- AI cost, latency, model availability, and provider data handling depend on OpenRouter and the selected model.
- Basic in-memory rate limiting is per process and is not a substitute for authentication or a distributed rate limiter.
