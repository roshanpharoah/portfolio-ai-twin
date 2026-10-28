import assert from "node:assert/strict";
import http from "node:http";
import { createAppServer } from "../server.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => {
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    server.close(resolve);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function json(response) {
  return response.json();
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log("ok - " + name);
    passed += 1;
  } catch (error) {
    console.error("not ok - " + name);
    console.error("  " + error.message);
    failed += 1;
  }
}

const mockState = { calls: 0, lastSystem: "", lastUser: "" };
const mock = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  const raw = await readBody(req);
  const body = JSON.parse(raw || "{}");
  mockState.calls += 1;
  mockState.lastSystem = body.messages && body.messages[0] ? body.messages[0].content : "";
  mockState.lastUser = body.messages && body.messages[1] ? body.messages[1].content : "";
  const payload = JSON.stringify({
    choices: [{ message: { content: "Mock AI answer grounded in the retrieved public notes." } }]
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(payload);
});

const errorMock = http.createServer((req, res) => {
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message: "mock upstream failure" } }));
});

const mockPort = await listen(mock);
const errorPort = await listen(errorMock);
const openrouterUrl = "http://127.0.0.1:" + mockPort + "/chat/completions";
const errorUrl = "http://127.0.0.1:" + errorPort + "/chat/completions";

const app = createAppServer({
  apiKey: "test-key",
  model: "test/model",
  openrouterUrl,
  certCount: 61,
  rateLimit: 100,
  maxBodyBytes: 4096,
  timeoutMs: 5000
});
const appPort = await listen(app);
const base = "http://127.0.0.1:" + appPort;

await test("reports the AI endpoint as available", async () => {
  const response = await fetch(base + "/api/status");
  assert.equal(response.status, 200);
  const data = await json(response);
  assert.equal(data.ai, true);
  assert.equal(data.model, "test/model");
  assert.equal(data.retrieval, "bm25");
  assert.ok(!JSON.stringify(data).includes("test-key"));
  const jsonResponse = await fetch(base + "/api/status.json");
  assert.equal(jsonResponse.status, 200);
  assert.equal((await json(jsonResponse)).ai, true);
});

await test("serves the portfolio and local RAG scripts", async () => {
  const home = await fetch(base + "/");
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(html.includes("Ask my notes"));
  assert.ok(!html.includes("test-key"));
  const script = await fetch(base + "/rag/rag-core.js");
  assert.equal(script.status, 200);
});

await test("does not serve secrets or server internals", async () => {
  for (const path of ["/.env", "/server.mjs", "/rag/SYSTEM_PROMPT.md", "/rag/source/private.example.json"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, path + " should not be served");
  }
});

await test("returns a grounded AI answer with source metadata", async () => {
  const before = mockState.calls;
  const response = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Tell me about PolicyPulse", mode: "technical" })
  });
  assert.equal(response.status, 200);
  const data = await json(response);
  assert.equal(data.ai, true);
  assert.ok(data.text[0].includes("Mock AI answer"));
  assert.ok(data.sources.some((source) => source.id === "policy"));
  assert.ok(mockState.calls > before);
  assert.ok(mockState.lastSystem.includes("RETRIEVED PUBLIC CONTEXT"));
  assert.ok(mockState.lastSystem.includes("PolicyPulse"));
  assert.ok(mockState.lastSystem.includes("61 certificates"));
  assert.equal(mockState.lastUser, "Tell me about PolicyPulse");
});

await test("blocks a private question without calling the model", async () => {
  const before = mockState.calls;
  const response = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What is your CGPA?", mode: "portfolio" })
  });
  assert.equal(response.status, 200);
  const data = await json(response);
  assert.equal(data.ai, false);
  assert.equal(data.reason, "privacy");
  assert.equal(data.sources[0].id, "public_boundary");
  assert.equal(mockState.calls, before);
});

await test("blocks an unknown preference without calling the model", async () => {
  const before = mockState.calls;
  const response = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What is his favorite movie?", mode: "personal" })
  });
  assert.equal(response.status, 200);
  const data = await json(response);
  assert.equal(data.ai, false);
  assert.equal(data.reason, "unknown");
  assert.equal(data.sources[0].id, "unknown_prefs");
  assert.equal(mockState.calls, before);
});

await test("supports a follow-up with the previous source context", async () => {
  const response = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Tell me more", mode: "technical", last: { id: "policy", mode: "technical" } })
  });
  assert.equal(response.status, 200);
  const data = await json(response);
  const ids = data.sources.map((source) => source.id);
  assert.ok(ids.includes("policy"));
  assert.ok(ids.includes("library"));
});

await test("rejects an oversized request body", async () => {
  const response = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "x".repeat(5000), mode: "auto" })
  });
  assert.equal(response.status, 413);
});

const limited = createAppServer({
  apiKey: "test-key",
  openrouterUrl,
  rateLimit: 2,
  rateWindowMs: 60000
});
const limitedPort = await listen(limited);
const limitedBase = "http://127.0.0.1:" + limitedPort;
await test("rate limits repeated API requests", async () => {
  for (let index = 0; index < 2; index += 1) {
    const response = await fetch(limitedBase + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Who are you?", mode: "portfolio" })
    });
    assert.equal(response.status, 200);
  }
  const blocked = await fetch(limitedBase + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Who are you?", mode: "portfolio" })
  });
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"));
});
await close(limited);

const noKey = createAppServer({ apiKey: "" });
const noKeyPort = await listen(noKey);
const noKeyBase = "http://127.0.0.1:" + noKeyPort;
await test("reports AI as disabled without a key", async () => {
  const status = await fetch(noKeyBase + "/api/status");
  const data = await json(status);
  assert.equal(data.ai, false);
  const response = await fetch(noKeyBase + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Who are you?" })
  });
  assert.equal(response.status, 503);
});
await close(noKey);

const broken = createAppServer({ apiKey: "test-key", openrouterUrl: errorUrl, rateLimit: 100 });
const brokenPort = await listen(broken);
const brokenBase = "http://127.0.0.1:" + brokenPort;
await test("returns a fallback signal when the upstream fails", async () => {
  const response = await fetch(brokenBase + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Tell me about PolicyPulse" })
  });
  assert.equal(response.status, 502);
  const data = await json(response);
  assert.equal(data.fallback, true);
});
await close(broken);

await close(app);
await close(mock);
await close(errorMock);

console.log("\nPassed: " + passed);
console.log("Failed: " + failed);
if (failed) process.exit(1);
