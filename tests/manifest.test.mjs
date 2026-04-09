import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadManifest() {
  return JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
}

test("manifest name is Templator", () => {
  const manifest = loadManifest();
  assert.equal(manifest.name, "Templator");
});

test("manifest gecko extension id is templator@local", () => {
  const manifest = loadManifest();
  assert.equal(manifest.browser_specific_settings.gecko.id, "templator@local");
});

test("manifest compose_action default_title is Templator", () => {
  const manifest = loadManifest();
  assert.equal(manifest.compose_action.default_title, "Templator");
});

test("manifest name does not contain old Mail Templates branding", () => {
  const manifest = loadManifest();
  assert.ok(!manifest.name.includes("Mail Templates"), "name should not contain old branding");
  assert.ok(!manifest.browser_specific_settings.gecko.id.includes("mail-templates"), "id should not contain old branding");
  assert.ok(!manifest.compose_action.default_title.includes("Mail Templates"), "title should not contain old branding");
});

test("manifest version and description are preserved after rename", () => {
  const manifest = loadManifest();
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.description, "Create and apply mail templates with input fields.");
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "115.0");
});