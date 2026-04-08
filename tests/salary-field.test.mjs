import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadSalaryField() {
  const code = readFileSync(join(root, "shared/salary-field.js"), "utf8");
  const ctx = { window: {} };
  runInContext(code, createContext(ctx));
  return ctx.window.SalaryField;
}

test("computeSalaryFieldValue parses time and rate", () => {
  const { computeSalaryFieldValue } = loadSalaryField();
  assert.equal(computeSalaryFieldValue("2:30", "10"), "25.00");
  assert.equal(computeSalaryFieldValue("bad", "10"), "");
});

test("mergeSalaryFieldsIntoValues fills calculateSalary from dependencies", () => {
  const { mergeSalaryFieldsIntoValues } = loadSalaryField();
  const fields = [
    { id: "hours", type: "text" },
    { id: "rate", type: "text" },
    { id: "pay", type: "calculateSalary", timeFieldId: "hours", rateFieldId: "rate" },
  ];
  const values = { hours: "1:00", rate: "50" };
  const merged = mergeSalaryFieldsIntoValues(fields, values);
  assert.equal(merged.pay, "50.00");
});
