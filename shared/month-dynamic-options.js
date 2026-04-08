"use strict";

function normalizeLocale(locale) {
  if (!locale) {
    return undefined;
  }
  if (locale === "pl") {
    return "pl-PL";
  }
  return locale;
}

function formatMonth(date, format, locale) {
  let config = { month: "long", year: "numeric" };
  switch (format) {
    case "month":
      config = { month: "long" };
      break;
    case "shortMonth":
      config = { month: "short" };
      break;
    case "shortMonthYear":
      config = { month: "short", year: "numeric" };
      break;
    case "monthYear":
    default:
      config = { month: "long", year: "numeric" };
      break;
  }
  return new Intl.DateTimeFormat(locale, config).format(date);
}

function buildMonthOptionsFromRange({ monthsBefore, monthsAfter, format, locale }) {
  const base = new Date();
  const options = [];
  for (let offset = -monthsBefore; offset <= monthsAfter; offset += 1) {
    const date = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    options.push(formatMonth(date, format, locale));
  }
  return options;
}

function buildMonthOptionsLegacy({ count, startOffset, step, format, locale }) {
  const options = [];
  const base = new Date();

  for (let i = 0; i < count; i += 1) {
    const date = new Date(base.getFullYear(), base.getMonth() + startOffset + step * i, 1);
    options.push(formatMonth(date, format, locale));
  }

  return options;
}

function hasMonthRangeConfig(optionsDynamic) {
  return (
    Number.isFinite(optionsDynamic.monthsBefore) || Number.isFinite(optionsDynamic.monthsAfter)
  );
}

function buildDynamicMonthOptions(optionsDynamic) {
  if (optionsDynamic === "months") {
    return buildMonthOptionsFromRange({
      monthsBefore: 1,
      monthsAfter: 0,
      format: "monthYear",
      locale: undefined,
    });
  }

  if (optionsDynamic && optionsDynamic.type === "months") {
    const format = optionsDynamic.format || "monthYear";
    const locale = normalizeLocale(optionsDynamic.locale);

    if (hasMonthRangeConfig(optionsDynamic)) {
      const monthsBefore = Number.isFinite(optionsDynamic.monthsBefore)
        ? optionsDynamic.monthsBefore
        : 0;
      const monthsAfter = Number.isFinite(optionsDynamic.monthsAfter)
        ? optionsDynamic.monthsAfter
        : 0;
      return buildMonthOptionsFromRange({
        monthsBefore: Math.max(0, monthsBefore),
        monthsAfter: Math.max(0, monthsAfter),
        format,
        locale,
      });
    }

    return buildMonthOptionsLegacy({
      count: Number.isFinite(optionsDynamic.count) ? optionsDynamic.count : 2,
      startOffset: Number.isFinite(optionsDynamic.startOffset) ? optionsDynamic.startOffset : 0,
      step: Number.isFinite(optionsDynamic.step) ? optionsDynamic.step : -1,
      format,
      locale,
    });
  }

  return [];
}

window.MonthDynamicOptions = {
  normalizeLocale,
  formatMonth,
  buildMonthOptionsFromRange,
  buildDynamicMonthOptions,
};
