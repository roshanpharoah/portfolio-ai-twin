import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, "source", "public.json");
const outputPath = path.join(here, "knowledge-public.js");

const CATEGORIES = new Set([
  "identity",
  "education",
  "career",
  "experience",
  "projects",
  "skills",
  "learning",
  "interests",
  "contact",
  "meta",
  "preferences"
]);

const EVIDENCE_TYPES = new Set([
  "user_confirmed",
  "user_reported_event",
  "historical_record",
  "assistant_inference",
  "unverified_claim",
  "unknown",
  "reference"
]);

const SOURCE_TYPES = new Set(["curated_note", "reference"]);

const STATUSES = new Set([
  "current",
  "historical",
  "exploratory",
  "unknown",
  "completed",
  "prototype",
  "archived"
]);

const CONFIDENCE = new Set(["high", "medium", "low"]);
const SENSITIVITY = new Set(["public", "low", "private"]);
const SECTIONS = new Set(["about", "now", "skills", "projects", "think", "experience", "certs", "contact"]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error("Could not read " + file);
    console.error(error.message);
    process.exit(1);
  }
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const source = readJson(sourcePath);
const errors = [];
const warnings = [];
const defaults = source.defaults || {};
const rawEntries = Array.isArray(source.entries) ? source.entries : [];
const seen = new Set();
const textSeen = new Map();
const publicEntries = [];

if (!source.version) errors.push("Top-level version is required.");
if (!source.updated_at) errors.push("Top-level updated_at is required.");
if (!isStringArray(source.defaultChips)) errors.push("Top-level defaultChips must be an array of strings.");

for (const raw of rawEntries) {
  const entry = { ...defaults, ...raw };
  const label = entry.id || "(missing id)";

  for (const field of [
    "id",
    "title",
    "category",
    "sec",
    "kw",
    "text",
    "source",
    "source_type",
    "evidence_type",
    "created_at",
    "updated_at",
    "status",
    "confidence",
    "sensitivity"
  ]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) {
      errors.push(label + ": " + field + " must be a non-empty string.");
    }
  }

  if (seen.has(entry.id)) errors.push(label + ": duplicate id.");
  seen.add(entry.id);
  if (typeof entry.id === "string" && !/^[a-z0-9_]+$/.test(entry.id)) errors.push(label + ": id must use lowercase letters, numbers, and underscores.");

  if (!CATEGORIES.has(entry.category)) errors.push(label + ": unknown category " + entry.category + ".");
  if (!SOURCE_TYPES.has(entry.source_type)) errors.push(label + ": unknown source_type " + entry.source_type + ".");
  if (!EVIDENCE_TYPES.has(entry.evidence_type)) errors.push(label + ": unknown evidence_type " + entry.evidence_type + ".");
  if (!STATUSES.has(entry.status)) errors.push(label + ": unknown status " + entry.status + ".");
  if (!CONFIDENCE.has(entry.confidence)) errors.push(label + ": unknown confidence " + entry.confidence + ".");
  if (!SENSITIVITY.has(entry.sensitivity)) errors.push(label + ": unknown sensitivity " + entry.sensitivity + ".");
  if (!SECTIONS.has(entry.sec)) errors.push(label + ": unknown section " + entry.sec + ".");
  if (typeof entry.public !== "boolean") errors.push(label + ": public must be a boolean.");
  if (typeof entry.is_current !== "boolean") errors.push(label + ": is_current must be a boolean.");
  if (entry.supersedes !== null && typeof entry.supersedes !== "string") errors.push(label + ": supersedes must be null or a string id.");
  if (typeof entry.created_at === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(entry.created_at)) errors.push(label + ": created_at must use YYYY-MM-DD.");
  if (typeof entry.updated_at === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(entry.updated_at)) errors.push(label + ": updated_at must use YYYY-MM-DD.");
  if (!isStringArray(entry.next)) errors.push(label + ": next must be an array of strings.");
  if (!isStringArray(entry.retrieval_tags)) errors.push(label + ": retrieval_tags must be an array of strings.");
  if (!isStringArray(entry.related_entities)) errors.push(label + ": related_entities must be an array of strings.");
  if (Array.isArray(entry.next) && entry.next.length > 4) warnings.push(label + ": more than four follow-up chips, only the first four will show.");
  if (typeof entry.text === "string" && entry.text.length < 20) errors.push(label + ": text is too short to answer from.");
  if (typeof entry.text === "string" && /[\u2014\u2013]/.test(entry.text)) errors.push(label + ": text contains an em dash or en dash. Use plain punctuation instead.");
  if (typeof entry.text === "string" && /\s--\s/.test(entry.text)) errors.push(label + ": text contains a spaced double hyphen. Use plain punctuation instead.");
  if (typeof entry.text === "string") {
    const normalizedText = entry.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (textSeen.has(normalizedText)) warnings.push(label + ": duplicate text with " + textSeen.get(normalizedText) + ".");
    else textSeen.set(normalizedText, label);
  }

  const isPublic = entry.public === true && (entry.sensitivity === "public" || entry.sensitivity === "low");
  if (isPublic) {
    publicEntries.push(entry);
  } else if (entry.sensitivity === "private" || entry.public === false) {
    errors.push(label + ": private entries are not allowed in source/public.json. Keep private records outside the deployed public source.");
  } else {
    errors.push(label + ": sensitivity " + entry.sensitivity + " is not allowed in the public bundle.");
  }
}

for (const entry of publicEntries) {
  if (entry.supersedes && !seen.has(entry.supersedes)) warnings.push(entry.id + ": supersedes unknown id " + entry.supersedes + ".");
  if (entry.is_current === false && !["historical", "archived"].includes(entry.status)) warnings.push(entry.id + ": is_current is false but status is " + entry.status + ".");
}

if (!publicEntries.length) errors.push("No public entries were found. Refusing to write an empty bundle.");
if (!source.defaultChips || source.defaultChips.length < 1) errors.push("At least one default chip is required.");

if (errors.length) {
  console.error("Knowledge build failed with " + errors.length + " error(s):");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}

const bundle = {
  version: source.version,
  updated_at: source.updated_at,
  defaultChips: source.defaultChips,
  entries: publicEntries
};

const serialized = JSON.stringify(bundle, null, 2);
const output = [
  "/* AUTO-GENERATED FILE. Do not edit directly. */",
  "/* Edit rag/source/public.json and run: node rag/build.mjs */",
  "(function (root, factory) {",
  "  if (typeof module === \"object\" && module.exports) module.exports = factory();",
  "  else root.RoshanKnowledge = factory();",
  "})(typeof globalThis !== \"undefined\" ? globalThis : this, function () {",
  "  \"use strict\";",
  "  return " + serialized + ";",
  "});",
  ""
].join("\n");

fs.writeFileSync(outputPath, output, "utf8");

console.log("Knowledge build complete.");
console.log("Source entries: " + rawEntries.length);
console.log("Public entries: " + publicEntries.length);
console.log("Output: " + path.relative(process.cwd(), outputPath));
if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log("- " + warning);
}
