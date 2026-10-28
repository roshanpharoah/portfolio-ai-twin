import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const kb = require("./knowledge-public.js");
const core = require("./rag-core.js");
const rag = core.create(kb, { certCount: 61 });

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("ok - " + name);
    passed += 1;
  } catch (error) {
    console.error("not ok - " + name);
    console.error("  " + error.message);
    failed += 1;
  }
}

function ids(result) {
  return (result.sources || []).map((source) => source.id);
}

function answerText(result) {
  return (result.text || []).join(" ");
}

function expectSource(result, id) {
  assert.ok(ids(result).includes(id), "expected source " + id + ", got " + ids(result).join(", "));
}

function expectText(result, fragment) {
  assert.ok(answerText(result).toLowerCase().includes(fragment.toLowerCase()), "expected text to include " + fragment);
}

test("classifies a portfolio identity question", () => {
  assert.equal(core.classifyQuery("Who is Roshan?"), "portfolio");
});

test("classifies a technical project question", () => {
  assert.equal(core.classifyQuery("Explain the architecture of PolicyPulse"), "technical");
});

test("classifies a personal learning question", () => {
  assert.equal(core.classifyQuery("How do you learn?"), "personal");
});

test("classifies an interview request", () => {
  assert.equal(core.classifyQuery("Interview me on projects"), "interview");
});

test("classifies a learning explanation", () => {
  assert.equal(core.classifyQuery("Explain Bayes theorem"), "learning");
});

test("forced modes override auto classification", () => {
  assert.equal(core.classifyQuery("How do you learn?", "learning"), "learning");
  assert.equal(core.classifyQuery("Tell me about projects", "personal"), "personal");
});

test("privacy guard blocks a CGPA question", () => {
  assert.equal(core.privacyCheck("What is his CGPA?"), true);
});

test("privacy guard allows a general relationship question", () => {
  assert.equal(core.privacyCheck("What is the relationship between precision and recall?"), false);
});

test("privacy guard allows a general bank question", () => {
  assert.equal(core.privacyCheck("What is a bank?"), false);
});

test("privacy guard blocks the purse incident", () => {
  assert.equal(core.privacyCheck("What happened with the purse?"), true);
});

test("privacy guard blocks an address question", () => {
  assert.equal(core.privacyCheck("What is your address?"), true);
});

test("privacy guard allows a general room temperature question", () => {
  assert.equal(core.privacyCheck("What is the room temperature effect?"), false);
});

test("privacy guard blocks astrology and finance questions", () => {
  assert.equal(core.privacyCheck("What is your zodiac sign?"), true);
  assert.equal(core.privacyCheck("What is your financial situation?"), true);
});

test("privacy guard blocks personality and relationship questions", () => {
  assert.equal(core.privacyCheck("What is your personality type?"), true);
  assert.equal(core.privacyCheck("Are you married?"), true);
  assert.equal(core.privacyCheck("Do you have ADHD?"), true);
});

test("privacy guard allows general technical uses of sensitive words", () => {
  assert.equal(core.privacyCheck("What is the orientation of a matrix?"), false);
  assert.equal(core.privacyCheck("What is a token in NLP?"), false);
  assert.equal(core.privacyCheck("What is a package in Java?"), false);
  assert.equal(core.privacyCheck("What is a single point of failure?"), false);
});

test("answers the education question", () => {
  const result = rag.answer("What is Roshan studying?");
  expectSource(result, "edu");
  expectText(result, "B.Tech");
});

test("answers the professional identity question", () => {
  const result = rag.answer("Who is Roshan professionally?");
  expectSource(result, "about");
  expectSource(result, "roles");
  expectText(result, "B.Tech");
});

test("answers the what do you do question", () => {
  const result = rag.answer("What do you do?");
  expectSource(result, "about");
  expectSource(result, "roles");
});

test("answers the current work question", () => {
  const result = rag.answer("What are you working on?");
  expectSource(result, "now");
  expectSource(result, "vdart");
});

test("answers the work experience question", () => {
  const result = rag.answer("Tell me about your work experience");
  expectSource(result, "vdart");
  expectSource(result, "work");
});

test("answers the projects overview question", () => {
  const result = rag.answer("Which projects has he worked on?");
  expectSource(result, "projects");
  expectText(result, "seven main things");
});

test("answers the built and contributed question", () => {
  const result = rag.answer("What has he actually built and contributed to?");
  expectSource(result, "projects");
  expectText(result, "seven main things");
});

test("answers the goals and trade-offs question", () => {
  const result = rag.answer("What goals and trade-offs has he discussed?");
  expectSource(result, "now");
  expectSource(result, "career_tradeoffs");
  expectText(result, "placements");
});

test("answers the synthetic data contribution question", () => {
  const result = rag.answer("What did he contribute to the synthetic data platform?");
  expectSource(result, "synthetic");
  expectText(result, "CTGAN");
});

test("answers the mentoring question", () => {
  const result = rag.answer("What is his mentoring experience?");
  expectSource(result, "mentor");
  expectText(result, "interns");
});

test("answers the certificate count with the live count", () => {
  const result = rag.answer("What certificates do you have?");
  expectSource(result, "certs");
  expectText(result, "61 certificates");
});

test("answers the PolicyPulse architecture question", () => {
  const result = rag.answer("Explain the architecture of PolicyPulse");
  expectSource(result, "policy");
  expectText(result, "TF-IDF");
});

test("answers the synthetic data rationale question", () => {
  const result = rag.answer("Why use synthetic data?");
  expectSource(result, "synthetic");
  expectText(result, "differential-privacy");
});

test("answers the communication preference question", () => {
  const result = rag.answer("What communication style does Roshan prefer?");
  expectSource(result, "communication");
  expectText(result, "direct");
});

test("answers the career uncertainty question", () => {
  const result = rag.answer("What career uncertainties has he discussed?");
  assert.ok(ids(result).some((id) => id === "career_tradeoffs" || id === "study"), "expected a career uncertainty source, got " + ids(result).join(", "));
  expectText(result, "work-first");
});

test("answers the documented personal experiences question", () => {
  const result = rag.answer("What personal experiences are documented?");
  expectSource(result, "career_tradeoffs");
  expectSource(result, "public_boundary");
  expectText(result, "work-first");
});

test("answers the evidence status question", () => {
  const result = rag.answer("What is known versus inferred?");
  expectSource(result, "evidence_status");
  expectText(result, "Confirmed public notes");
});

test("answers the conflict handling question", () => {
  const result = rag.answer("What should happen when two memories disagree?");
  expectSource(result, "evidence_status");
  expectText(result, "newer confirmed value");
});

test("says the favorite movie is unknown", () => {
  const result = rag.answer("What is his favorite movie?");
  expectSource(result, "unknown_prefs");
  expectText(result, "no confirmed favorite");
});

test("says the favorite singer is unknown", () => {
  const result = rag.answer("Which singer does he like most?");
  expectSource(result, "unknown_prefs");
  expectText(result, "no confirmed favorite");
});

test("supports technical mode", () => {
  const result = rag.answer("Explain PolicyPulse architecture", { mode: "technical" });
  assert.equal(result.mode, "technical");
  expectSource(result, "policy");
});

test("supports personal mode", () => {
  const result = rag.answer("How do you learn?", { mode: "personal" });
  assert.equal(result.mode, "personal");
  assert.ok(ids(result).some((id) => id === "learn" || id === "communication"), "expected a learning or communication source");
});

test("supports interview mode with a generated question", () => {
  const result = rag.answer("Interview me on projects", { mode: "interview" });
  assert.equal(result.kind, "interview");
  assert.equal(result.mode, "interview");
  expectText(result, "Interview question");
});

test("supports learning mode with Bayes intuition", () => {
  const result = rag.answer("Explain Bayes theorem", { mode: "learning" });
  assert.equal(result.mode, "learning");
  expectSource(result, "bayes");
  expectText(result, "Start with the problem");
});

test("supports learning mode with BM25 intuition", () => {
  const result = rag.answer("Teach me the intuition behind BM25", { mode: "learning" });
  assert.equal(result.mode, "learning");
  assert.equal(result.sources[0].id, "bm25");
  expectText(result, "rare words");
});

test("supports a follow-up with the previous context", () => {
  const first = rag.answer("Tell me about PolicyPulse");
  const second = rag.answer("Tell me more", { last: { id: first.sources[0].id, mode: first.mode } });
  assert.equal(second.followUp, true);
  assert.equal(second.sources[0].id, first.sources[0].id);
  assert.ok(second.sources.some((source) => source.id !== first.sources[0].id), "expected a related follow-up source");
});

test("supports a natural follow-up phrasing", () => {
  const first = rag.answer("Tell me about PolicyPulse");
  const second = rag.answer("Can you tell me more?", { last: { id: first.sources[0].id, mode: first.mode } });
  assert.equal(second.followUp, true);
  assert.equal(second.sources[0].id, first.sources[0].id);
  assert.ok(second.sources.some((source) => source.id !== first.sources[0].id), "expected a related follow-up source");
});

test("blocks private CGPA details", () => {
  const result = rag.answer("What is his CGPA?");
  assert.equal(result.kind, "private");
  expectSource(result, "public_boundary");
  expectText(result, "private");
  assert.ok(!answerText(result).includes("8."), "private answer leaked a numeric CGPA");
});

test("blocks private bank details", () => {
  const result = rag.answer("What is his bank balance?");
  assert.equal(result.kind, "private");
  expectText(result, "private");
});

test("blocks the purse incident", () => {
  const result = rag.answer("What happened with the purse?");
  assert.equal(result.kind, "private");
  assert.ok(!answerText(result).toLowerCase().includes("theatre"), "private answer leaked the theatre context");
});

test("blocks exact hostel details", () => {
  const result = rag.answer("What is his hostel room?");
  assert.equal(result.kind, "private");
  assert.ok(!answerText(result).includes("748"), "private answer leaked the room number");
});

test("blocks health details", () => {
  const result = rag.answer("Does he have acne?");
  assert.equal(result.kind, "private");
});

test("blocks family details", () => {
  const result = rag.answer("Who are his parents?");
  assert.equal(result.kind, "private");
});

test("blocks date of birth details", () => {
  const result = rag.answer("What is his date of birth?");
  assert.equal(result.kind, "private");
});

test("blocks ambiguous romantic context", () => {
  const result = rag.answer("Why was Roshan upset when the girls stopped smiling?");
  assert.equal(result.kind, "private");
});

test("blocks the purse outcome question", () => {
  const result = rag.answer("What was the exact outcome of the purse incident?");
  assert.equal(result.kind, "private");
});

test("does not bundle private identifiers", () => {
  const serialized = JSON.stringify(kb.entries).toLowerCase();
  for (const term of ["748", "isotretinoin", "radha", "karur", "purse", "theatre", "acne", "cgpa", "hostel"]) {
    assert.ok(!serialized.includes(term), "public bundle leaked " + term);
  }
});

test("excludes non-current entries from ordinary retrieval", () => {
  const fixture = {
    ...kb,
    entries: [
      ...kb.entries,
      {
        ...kb.entries[0],
        id: "legacy_snapshot",
        title: "Old academic snapshot",
        category: "education",
        kw: "academic snapshot old record",
        text: "An old academic snapshot that should stay historical.",
        is_current: false,
        status: "historical",
        evidence_type: "historical_record",
        retrieval_tags: ["history"],
        next: []
      }
    ]
  };
  const fixtureRag = core.create(fixture, { certCount: 61 });
  const ordinary = fixtureRag.retrieve("academic snapshot");
  assert.ok(!ordinary.some((result) => result.n.id === "legacy_snapshot"), "non-current entry appeared in ordinary retrieval");
  const historical = fixtureRag.retrieve("historical academic snapshot");
  assert.ok(historical.some((result) => result.n.id === "legacy_snapshot"), "historical query did not retrieve the historical entry");
});

test("every public source has evidence metadata", () => {
  for (const entry of kb.entries) {
    assert.ok(entry.source, entry.id + " is missing source");
    assert.ok(entry.source_type, entry.id + " is missing source_type");
    assert.ok(entry.evidence_type, entry.id + " is missing evidence_type");
    assert.ok(entry.updated_at, entry.id + " is missing updated_at");
    assert.ok(typeof entry.public === "boolean", entry.id + " is missing public flag");
    assert.ok(entry.sensitivity === "public" || entry.sensitivity === "low", entry.id + " has an unsafe sensitivity");
  }
});

console.log("");
console.log("Passed: " + passed);
console.log("Failed: " + failed);
if (failed) process.exit(1);
