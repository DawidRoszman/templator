"use strict";

function parseTimeToHours(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return NaN;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return NaN;
  }
  const hoursPart = parseInt(match[1], 10);
  const minutesPart = parseInt(match[2], 10);
  if (minutesPart >= 60 || hoursPart < 0) {
    return NaN;
  }
  return hoursPart + minutesPart / 60;
}

function parseHourlyRate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return NaN;
  }
  const normalized = trimmed.replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function formatSalaryAmount(amount) {
  if (!Number.isFinite(amount)) {
    return "";
  }
  return amount.toFixed(2);
}

function computeSalaryFieldValue(timeStr, rateStr) {
  const hours = parseTimeToHours(timeStr);
  const rate = parseHourlyRate(rateStr);
  if (!Number.isFinite(hours) || !Number.isFinite(rate)) {
    return "";
  }
  return formatSalaryAmount(hours * rate);
}

function mergeSalaryFieldsIntoValues(fields, values) {
  const result = { ...values };
  const fieldList = Array.isArray(fields) ? fields : [];
  const maxIterations = fieldList.length + 1;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let hasChanged = false;
    fieldList.forEach((field) => {
      if (field.type !== "calculateSalary" || !field.id) {
        return;
      }
      const timeStr = result[field.timeFieldId] ?? "";
      const rateStr = result[field.rateFieldId] ?? "";
      const newValue = computeSalaryFieldValue(timeStr, rateStr);
      if (result[field.id] !== newValue) {
        result[field.id] = newValue;
        hasChanged = true;
      }
    });
    if (!hasChanged) {
      break;
    }
  }
  return result;
}

window.SalaryField = {
  parseTimeToHours,
  parseHourlyRate,
  formatSalaryAmount,
  computeSalaryFieldValue,
  mergeSalaryFieldsIntoValues,
};
