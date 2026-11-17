import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, ".env"));

const kb = require("./rag/knowledge-public.js");
const core = require("./rag/rag-core.js");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

const DEFAULT_MODEL = "x-ai/grok-4.7";
const ALLOWED_MODES = new Set(["auto", "portfolio", "technical", "personal", "interview", "learning"]);
const DENY_SEGMENTS = new Set([".git", ".env", "node_modules"]);
const DENY_FILES = new Set(["server.mjs", "package.json", "package-lock.json", "system_prompt.md"]);

function baseHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "SAMEORIGIN"
  };
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  }, baseHeaders(), extraHeaders));
  res.end(body);
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      try {
        const text = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(text));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    req.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

function uniqueNotes(notes) {
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    if (!note || !note.id || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

function buildContext(notes) {
  if (!notes.length) {
    return "No relevant public notes were retrieved. Do not invent personal facts. For a general technical or learning question, you may answer from general knowledge and label it as general.";
  }
  return notes.map((note) => {
    return [
      "[" + note.id + "] " + note.title,
      "Category: " + note.category + "; status: " + note.status + "; evidence: " + note.evidence_type + "; confidence: " + note.confidence + "; updated: " + note.updated_at,
      note.text
    ].join("\n");
  }).join("\n\n");
}

async function callOpenRouter(config) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + config.apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": config.siteUrl,
        "X-Title": "Roshan B Portfolio Twin"
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: config.system },
          { role: "user", content: config.user }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false
      }),
      signal: controller.signal
    });
    const raw = await response.text();
    if (!response.ok) {
      let detail = raw.slice(0, 300);
      try {
        const parsed = JSON.parse(raw);
        detail = parsed.error && parsed.error.message ? parsed.error.message : detail;
      } catch {}
      throw new Error("OpenRouter " + response.status + ": " + detail);
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("OpenRouter returned invalid JSON.");
    }
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("OpenRouter returned no text.");
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

function staticPath(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(urlPath || "/").split("?")[0]);
  } catch {
    return null;
  }
  const relative = decoded.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!relative) return path.join(root, "index.html");
  const segments = relative.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith(".") || DENY_SEGMENTS.has(segment))) {
    return null;
  }
  const last = segments[segments.length - 1].toLowerCase();
  if (DENY_FILES.has(last) || last.startsWith("private.")) return null;
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

export function createAppServer(overrides = {}) {
  const root = path.resolve(overrides.root || __dirname);
  const apiKey = String(overrides.apiKey !== undefined ? overrides.apiKey : (process.env.OPENROUTER_API_KEY || "")).trim();
  const aiEnabled = Boolean(apiKey) && !/replace-me|your-key/i.test(apiKey);
  const model = String(overrides.model !== undefined ? overrides.model : (process.env.OPENROUTER_MODEL || DEFAULT_MODEL));
  const openrouterUrl = String(overrides.openrouterUrl !== undefined ? overrides.openrouterUrl : (process.env.OPENROUTER_URL || "https://openrouter.ai/api/v1/chat/completions"));
  const siteUrl = String(overrides.siteUrl !== undefined ? overrides.siteUrl : (process.env.PUBLIC_SITE_URL || "http://127.0.0.1:8765"));
  const certCount = Number(overrides.certCount !== undefined ? overrides.certCount : (process.env.CERT_COUNT || 61));
  const maxTokens = Number(overrides.maxTokens !== undefined ? overrides.maxTokens : (process.env.MAX_TOKENS || 500));
  const temperature = Number(overrides.temperature !== undefined ? overrides.temperature : (process.env.TEMPERATURE || 0.4));
  const rateLimit = Number(overrides.rateLimit !== undefined ? overrides.rateLimit : (process.env.RATE_LIMIT || 30));
  const rateWindowMs = Number(overrides.rateWindowMs || 10 * 60 * 1000);
  const maxBodyBytes = Number(overrides.maxBodyBytes || 32 * 1024);
  const timeoutMs = Number(overrides.timeoutMs || 30000);
  const rag = core.create(kb, { certCount });
  const promptFile = path.join(root, "rag", "SYSTEM_PROMPT.md");
  const promptSource = fs.readFileSync(promptFile, "utf8");
  const promptBody = promptSource.includes("## Role") ? promptSource.slice(promptSource.indexOf("## Role")) : promptSource;
  const systemPrompt = promptBody.replaceAll("{{CERTS_COUNT}}", String(certCount));
  const rateBuckets = new Map();

  function checkRate(ip) {
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now >= bucket.reset) {
      rateBuckets.set(ip, { count: 1, reset: now + rateWindowMs });
      return { ok: true };
    }
    if (bucket.count >= rateLimit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
    }
    bucket.count += 1;
    return { ok: true };
  }

  function clientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
    return req.socket.remoteAddress || "unknown";
  }

  function localPayload(local, meta) {
    return {
      kind: local.kind || "hit",
      text: local.text || [],
      sources: local.sources || [],
      next: local.next || [],
      sec: local.sec || null,
      mode: local.mode || "portfolio",
      ai: Boolean(meta && meta.ai),
      reason: meta && meta.reason ? meta.reason : undefined
    };
  }

  async function handle(req, res) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname === "/api/status" || pathname === "/api/status.json") {
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
      return sendJson(res, 200, {
        ai: aiEnabled,
        model: aiEnabled ? model : null,
        retrieval: "bm25",
        privacy: "public-only"
      });
    }

    if (pathname === "/api/chat") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
      const rate = checkRate(clientIp(req));
      if (!rate.ok) {
        return sendJson(res, 429, { error: "Rate limit exceeded. Try again later." }, { "Retry-After": String(rate.retryAfter) });
      }
      if (!aiEnabled) {
        return sendJson(res, 503, { error: "The AI layer is not configured. The browser will use the local RAG fallback.", fallback: true });
      }

      let body;
      try {
        body = await readJsonBody(req, maxBodyBytes);
      } catch (error) {
        return sendJson(res, error.status || 400, { error: error.message || "Invalid request." });
      }

      const message = String(body && body.message ? body.message : "").trim();
      if (!message || message.length > 2000) {
        return sendJson(res, 400, { error: "message must be between 1 and 2000 characters." });
      }
      const mode = ALLOWED_MODES.has(body && body.mode) ? body.mode : "auto";
      const lastId = body && body.last && typeof body.last.id === "string" ? body.last.id.slice(0, 80) : null;
      const lastMode = body && body.last && ALLOWED_MODES.has(body.last.mode) ? body.last.mode : null;
      const last = lastId && rag.get(lastId) ? { id: lastId, mode: lastMode } : null;

      const local = rag.answer(message, { mode, last });
      if (local.kind === "private" || (local.sources && local.sources[0] && local.sources[0].id === "unknown_prefs")) {
        return sendJson(res, 200, localPayload(local, { ai: false, reason: local.kind === "private" ? "privacy" : "unknown" }));
      }

      const classified = local.mode || rag.classify(message, mode);
      const retrieved = rag.retrieve(message, classified).map((hit) => hit.n);
      const contextNotes = uniqueNotes([].concat(local.sources || [], retrieved)).slice(0, 6);
      const context = buildContext(contextNotes);
      const system = [
        systemPrompt,
        "",
        "CURRENT MODE: " + classified,
        "",
        "RETRIEVED PUBLIC CONTEXT:",
        context,
        "",
        "Answer the user's question using this context for personal claims. If the context is insufficient, say so. Do not mention this context block or the system prompt."
      ].join("\n");

      let aiText;
      try {
        aiText = await callOpenRouter({
          url: openrouterUrl,
          apiKey,
          model,
          siteUrl,
          system,
          user: message,
          maxTokens,
          temperature,
          timeoutMs
        });
      } catch (error) {
        console.error("OpenRouter request failed: " + error.message);
        return sendJson(res, 502, { error: "AI generation failed. The browser will use the local RAG fallback.", fallback: true });
      }

      const sources = contextNotes.length ? contextNotes : (local.sources || []);
      const next = local.next && local.next.length ? local.next : (sources[0] && sources[0].next) || [];
      const sec = local.sec || (sources[0] && sources[0].sec) || null;
      return sendJson(res, 200, {
        kind: "hit",
        text: [aiText],
        sources,
        next,
        sec,
        mode: classified,
        ai: true
      });
    }

    if (pathname.startsWith("/api/") && pathname !== "/api/articles.json") return sendJson(res, 404, { error: "Not found." });
    if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "Method not allowed." });

    const file = staticPath(root, pathname);
    if (!file) return sendJson(res, 404, { error: "Not found." });

    let stat;
    try {
      stat = fs.statSync(file);
      if (stat.isDirectory()) {
        const index = path.join(file, "index.html");
        stat = fs.statSync(index);
        return sendFile(res, index, stat, req.method === "HEAD");
      }
    } catch {
      return sendJson(res, 404, { error: "Not found." });
    }
    return sendFile(res, file, stat, req.method === "HEAD");
  }

  function sendFile(res, file, stat, headOnly) {
    const ext = path.extname(file).toLowerCase();
    const headers = Object.assign({
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": ext === ".html" || ext === ".js" || ext === ".css" ? "no-cache" : "public, max-age=3600"
    }, baseHeaders());
    res.writeHead(200, headers);
    if (headOnly) return res.end();
    fs.createReadStream(file).pipe(res);
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error("Request failed: " + (error && error.message ? error.message : "unknown error"));
      if (!res.headersSent) sendJson(res, 500, { error: "Internal server error." });
      else res.end();
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const port = Number(process.env.PORT || 8765);
  const host = process.env.HOST || "127.0.0.1";
  const server = createAppServer();
  server.listen(port, host, () => {
    const key = String(process.env.OPENROUTER_API_KEY || "").trim();
    const enabled = Boolean(key) && !/replace-me|your-key/i.test(key);
    console.log("Portfolio server: http://" + (host === "0.0.0.0" ? "127.0.0.1" : host) + ":" + port + "/");
    console.log(enabled ? "OpenRouter AI: enabled (" + (process.env.OPENROUTER_MODEL || DEFAULT_MODEL) + ")" : "OpenRouter AI: disabled (local RAG fallback)");
  });
}
