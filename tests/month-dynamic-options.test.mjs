import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadMonthDynamicOptions() {
  const code = readFileSync(join(root, "shared/month-dynamic-options.js"), "utf8");
  const ctx = { window: {} };
  runInContext(code, createContext(ctx));
  return ctx.window.MonthDynamicOptions;
}

test("normalizeLocale maps pl to pl-PL", () => {
  const { normalizeLocale } = loadMonthDynamicOptions();
  assert.equal(normalizeLocale("pl"), "pl-PL");
  assert.equal(normalizeLocale(undefined), undefined);
});

test('buildDynamicMonthOptions with "months" returns two labels', () => {
  const { buildDynamicMonthOptions } = loadMonthDynamicOptions();
  const options = buildDynamicMonthOptions("months");
  assert.equal(options.length, 2);
  assert.ok(options.every((label) => typeof label === "string" && label.length > 0));
});
