"use strict";

const templateSelect = document.getElementById("templateSelect");
const fieldsSection = document.getElementById("fieldsSection");
const previewSection = document.getElementById("previewSection");
const subjectPreview = document.getElementById("subjectPreview");
const bodyPreview = document.getElementById("bodyPreview");
const statusEl = document.getElementById("status");
const applyButton = document.getElementById("applyTemplate");
const optionsButton = document.getElementById("openOptions");

let templates = [];
let currentTemplate = null;
let contactValues = {};

function setStatus(message) {
  statusEl.textContent = message;
}

function buildTemplateOptions() {
  templateSelect.innerHTML = "";
  if (templates.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No templates found";
    templateSelect.appendChild(option);
    return;
  }

  templates.forEach((template, index) => {
    const option = document.createElement("option");
    option.value = template.id || String(index);
    option.textContent = template.name || `Template ${index + 1}`;
    templateSelect.appendChild(option);
  });
}

function getTemplateByValue(value) {
  return templates.find((template, index) => (template.id || String(index)) === value);
}

function createFieldInput(field) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  const label = document.createElement("label");
  label.textContent = field.label || field.id;
  label.setAttribute("for", `field-${field.id}`);
  wrapper.appendChild(label);

  let input;
  if (field.type === "select") {
    input = document.createElement("select");
    resolveSelectOptions(field).forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      input.appendChild(option);
    });
  } else if (field.type === "calculateSalary") {
    input = document.createElement("input");
    input.type = "text";
    input.readOnly = true;
    input.placeholder = field.placeholder || "";
    input.tabIndex = -1;
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.placeholder = field.placeholder || "";
  }

  input.id = `field-${field.id}`;
  input.dataset.fieldId = field.id;
  input.required = Boolean(field.required);
  input.addEventListener("input", updatePreview);
  input.addEventListener("change", updatePreview);

  wrapper.appendChild(input);
  return wrapper;
}

function resolveSelectOptions(field) {
  const staticOptions = Array.isArray(field.options) ? field.options : [];
  const dynamicOptions = field.optionsDynamic ? buildDynamicOptions(field.optionsDynamic) : [];
  const merged = [...staticOptions, ...dynamicOptions];
  return [...new Set(merged)];
}

function buildDynamicOptions(optionsDynamic) {
  if (optionsDynamic === "months") {
    return buildMonthOptions({ count: 2, startOffset: 0, step: -1, format: "monthYear", locale: undefined });
  }

  if (optionsDynamic && optionsDynamic.type === "months") {
    return buildMonthOptions({
      count: Number.isFinite(optionsDynamic.count) ? optionsDynamic.count : 2,
      startOffset: Number.isFinite(optionsDynamic.startOffset) ? optionsDynamic.startOffset : 0,
      step: Number.isFinite(optionsDynamic.step) ? optionsDynamic.step : -1,
      format: optionsDynamic.format || "monthYear",
      locale: normalizeLocale(optionsDynamic.locale),
    });
  }

  return [];
}

function buildMonthOptions({ count, startOffset, step, format, locale }) {
  const options = [];
  const base = new Date();

  for (let i = 0; i < count; i += 1) {
    const date = new Date(base.getFullYear(), base.getMonth() + startOffset + step * i, 1);
    options.push(formatMonth(date, format, locale));
  }

  return options;
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

function normalizeLocale(locale) {
  if (!locale) {
    return undefined;
  }
  if (locale === "pl") {
    return "pl-PL";
  }
  return locale;
}

function renderFields(template) {
  fieldsSection.innerHTML = "";
  if (!template || !Array.isArray(template.fields)) {
    previewSection.classList.add("hidden");
    return;
  }

  template.fields.forEach((field) => {
    fieldsSection.appendChild(createFieldInput(field));
  });

  previewSection.classList.remove("hidden");
  updatePreview();
}

function collectValues() {
  const values = {};
  const inputs = fieldsSection.querySelectorAll("[data-field-id]");
  inputs.forEach((input) => {
    const fieldId = input.dataset.fieldId;
    const field = currentTemplate.fields.find((f) => f.id === fieldId);
    if (field && field.type === "calculateSalary") {
      return;
    }
    values[fieldId] = input.value || "";
  });
  return window.SalaryField.mergeSalaryFieldsIntoValues(currentTemplate.fields, values);
}

function syncComputedSalaryDisplays(formValues) {
  if (!currentTemplate || !Array.isArray(currentTemplate.fields)) {
    return;
  }
  currentTemplate.fields.forEach((field) => {
    if (field.type !== "calculateSalary" || !field.id) {
      return;
    }
    const el = document.getElementById(`field-${field.id}`);
    if (el) {
      el.value = formValues[field.id] || "";
    }
  });
}

function applyValues(text, values) {
  let result = text || "";
  Object.keys(values).forEach((key) => {
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
    result = result.replace(pattern, values[key]);
  });
  return result;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPlainText(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html || "";
  return wrapper.textContent || "";
}

function updatePreview() {
  if (!currentTemplate) {
    return;
  }
  const formValues = collectValues();
  const values = { ...contactValues, ...formValues };
  subjectPreview.textContent = applyValues(currentTemplate.subject, values);
  bodyPreview.textContent = toPlainText(applyValues(currentTemplate.body, values));
  syncComputedSalaryDisplays(formValues);
}

async function loadTemplates() {
  const data = await browser.storage.local.get("templates");
  templates = Array.isArray(data.templates) && data.templates.length > 0 ? data.templates : window.DEFAULT_TEMPLATES;
  buildTemplateOptions();
  const initialValue = templateSelect.options[0]?.value;
  if (initialValue) {
    templateSelect.value = initialValue;
    currentTemplate = getTemplateByValue(initialValue);
    renderFields(currentTemplate);
  }
  await loadContactValues();
}

function validateRequiredFields() {
  const values = collectValues();
  const inputs = fieldsSection.querySelectorAll("[data-field-id]");
  for (const input of inputs) {
    const fieldId = input.dataset.fieldId;
    const field = currentTemplate.fields.find((f) => f.id === fieldId);
    if (!field || !field.required) {
      continue;
    }
    const raw = values[fieldId] ?? "";
    if (!String(raw).trim()) {
      return input;
    }
  }
  return null;
}

async function applyTemplate() {
  if (!currentTemplate) {
    setStatus("Select a template first.");
    return;
  }

  const missing = validateRequiredFields();
  if (missing) {
    setStatus(`Fill required field: ${missing.dataset.fieldId}`);
    missing.focus();
    return;
  }

  const values = collectValues();
  const mergedValues = { ...contactValues, ...values };
  const subject = applyValues(currentTemplate.subject, mergedValues);
  const bodyHtml = applyValues(currentTemplate.body, mergedValues);
  const bodyPlain = toPlainText(bodyHtml);

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      setStatus("No active compose tab found.");
      return;
    }

    await browser.compose.setComposeDetails(tab.id, {
      subject,
      body: bodyHtml,
      plainTextBody: bodyPlain,
    });

    setStatus("Template applied.");
  } catch (error) {
    setStatus("Failed to apply template.");
    console.error(error);
  }
}

optionsButton.addEventListener("click", async () => {
  await browser.runtime.openOptionsPage();
});

templateSelect.addEventListener("change", (event) => {
  currentTemplate = getTemplateByValue(event.target.value);
  renderFields(currentTemplate);
});

applyButton.addEventListener("click", applyTemplate);

loadTemplates().catch((error) => {
  console.error(error);
  setStatus("Failed to load templates.");
});

async function loadContactValues() {
  contactValues = await fetchContactValues();
  updatePreview();
}

async function fetchContactValues() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      return {};
    }
    const details = await browser.compose.getComposeDetails(tab.id);
    const recipients = normalizeRecipients(details?.to);
    if (recipients.length === 0) {
      return {};
    }

    const recipientInfo = await resolveRecipientInfo(recipients[0]);
    if (!recipientInfo) {
      return {};
    }

    return buildContactValueMap(recipientInfo);
  } catch (error) {
    console.error(error);
    return {};
  }
}

function normalizeRecipients(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function resolveRecipientInfo(recipient) {
  if (recipient && typeof recipient === "object") {
    if (recipient.type === "contact" && recipient.id) {
      const contact = await browser.contacts.get(recipient.id);
      return mapContact(contact);
    }
    if (recipient.type === "mailingList" && recipient.id) {
      return null;
    }
  }

  if (typeof recipient === "string") {
    const { email, name } = parseAddress(recipient);
    if (!email && !name) {
      return null;
    }
    const contact = email ? await searchContactByEmail(email) : null;
    if (contact) {
      return mapContact(contact, email, name);
    }
    return mapContact(null, email, name);
  }

  return null;
}

async function searchContactByEmail(email) {
  if (!email) {
    return null;
  }
  const results = await browser.contacts.quickSearch({
    searchString: email,
    includeLocal: true,
  });
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

function mapContact(contact, emailFallback = "", nameFallback = "") {
  const properties = contact?.properties || {};
  const firstName = properties.FirstName || properties.firstName || "";
  const lastName = properties.LastName || properties.lastName || "";
  const displayName = properties.DisplayName || properties.displayName || nameFallback || "";
  const primaryEmail = properties.PrimaryEmail || properties.primaryEmail || emailFallback || "";

  const derived = deriveNameParts(displayName);
  return {
    firstName: firstName || derived.firstName,
    lastName: lastName || derived.lastName,
    displayName,
    email: primaryEmail,
  };
}

function buildContactValueMap(info) {
  const safe = (value) => value || "";
  return {
    "contact.firstName": safe(info.firstName),
    "contact.lastName": safe(info.lastName),
    "contact.displayName": safe(info.displayName),
    "contact.email": safe(info.email),
    contact_first_name: safe(info.firstName),
    contact_last_name: safe(info.lastName),
    contact_display_name: safe(info.displayName),
    contact_email: safe(info.email),
  };
}

function parseAddress(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^\"|\"$/g, ""), email: match[2].trim() };
  }
  if (trimmed.includes("@")) {
    return { name: "", email: trimmed };
  }
  return { name: trimmed, email: "" };
}

function deriveNameParts(displayName) {
  if (!displayName) {
    return { firstName: "", lastName: "" };
  }
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
