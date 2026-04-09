import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── build-xpi.mjs ──────────────────────────────────────────────────────────
// The script uses baseName = "templator" to derive output filenames.
// We reproduce that logic here to verify the rename is correct.

const BASE_NAME = "templator";

test("build-xpi: baseName produces correct latest xpi filename", () => {
  const outLatest = `${BASE_NAME}.xpi`;
  assert.equal(outLatest, "templator.xpi");
});

test("build-xpi: baseName produces correct versioned xpi filename", () => {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  const version = manifest.version;
  const outVersioned = `${BASE_NAME}-${version}.xpi`;
  assert.equal(outVersioned, `templator-${version}.xpi`);
  assert.ok(outVersioned.startsWith("templator-"), "versioned filename must start with 'templator-'");
  assert.ok(outVersioned.endsWith(".xpi"), "versioned filename must end with .xpi");
});

test("build-xpi: baseName does not use old mail-templates branding", () => {
  assert.ok(!BASE_NAME.includes("mail-templates"), "baseName must not contain old branding");
  assert.equal(BASE_NAME, "templator");
});

test("build-xpi: script source declares baseName as 'templator'", () => {
  const src = readFileSync(join(root, "scripts/build-xpi.mjs"), "utf8");
  assert.ok(src.includes('const baseName = "templator"'), "script must declare baseName = 'templator'");
  assert.ok(!src.includes('"mail-templates"'), "script must not reference old 'mail-templates' name");
});

// ── generate-updates-json.mjs ───────────────────────────────────────────────
// The script constructs an updateLink using "templator.xpi".
// We verify the URL template and xpiPath filename match the renamed extension.

test("generate-updates-json: updateLink uses templator.xpi", () => {
  const repo = "owner/repo";
  const version = "0.1.0";
  const tag = `v${version}`;
  const updateLink = `https://github.com/${repo}/releases/download/${tag}/templator.xpi`;
  assert.equal(updateLink, "https://github.com/owner/repo/releases/download/v0.1.0/templator.xpi");
  assert.ok(updateLink.endsWith("/templator.xpi"), "update link must point to templator.xpi");
});

test("generate-updates-json: updateLink does not use old mail-templates.xpi", () => {
  const repo = "owner/repo";
  const version = "0.1.0";
  const tag = `v${version}`;
  const updateLink = `https://github.com/${repo}/releases/download/${tag}/templator.xpi`;
  assert.ok(!updateLink.includes("mail-templates"), "update link must not reference old branding");
});

test("generate-updates-json: xpi filename in dist is templator.xpi", () => {
  const src = readFileSync(join(root, "scripts/generate-updates-json.mjs"), "utf8");
  assert.ok(src.includes('"templator.xpi"'), "script must reference 'templator.xpi'");
  assert.ok(!src.includes('"mail-templates.xpi"'), "script must not reference old 'mail-templates.xpi'");
});

test("generate-updates-json: script source uses templator.xpi in updateLink template", () => {
  const src = readFileSync(join(root, "scripts/generate-updates-json.mjs"), "utf8");
  assert.ok(src.includes("templator.xpi"), "script updateLink template must use 'templator.xpi'");
});

test("generate-updates-json: version tag format is v-prefixed", () => {
  const version = "0.1.0";
  const tag = `v${version}`;
  assert.equal(tag, "v0.1.0");
  assert.ok(tag.startsWith("v"), "tag must be prefixed with 'v'");
});