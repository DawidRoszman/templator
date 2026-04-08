"use strict";

const templatesList = document.getElementById("templates");
const addTemplateButton = document.getElementById("addTemplate");
const deleteTemplateButton = document.getElementById("deleteTemplate");
const saveAllButton = document.getElementById("saveAll");
const statusEl = document.getElementById("status");
const editorTitle = document.getElementById("editorTitle");

const templateIdInput = document.getElementById("templateId");
const templateNameInput = document.getElementById("templateName");
const templateSubjectInput = document.getElementById("templateSubject");
const subjectInsertSelect = document.getElementById("subjectInsert");

const fieldsContainer = document.getElementById("fields");
const addFieldButton = document.getElementById("addField");

const toolbar = document.querySelector(".toolbar");
const bodyEditor = document.getElementById("bodyEditor");
const bodyPreview = document.getElementById("bodyPreview");
const bodyInsertSelect = document.getElementById("bodyInsert");

const warningsList = document.getElementById("warnings");

const jsonPreview = document.getElementById("jsonPreview");
const jsonEditor = document.getElementById("jsonEditor");
const applyJsonButton = document.getElementById("applyJson");
const copyJsonButton = document.getElementById("copyJson");
const exportTemplatesButton = document.getElementById("exportTemplates");
const importTemplatesButton = document.getElementById("importTemplates");
const importFileInput = document.getElementById("importFile");

const CONTACT_PLACEHOLDER_KEYS = new Set([
  "contact.firstName",
  "contact.lastName",
  "contact.displayName",
  "contact.email",
  "contact_first_name",
  "contact_last_name",
  "contact_display_name",
  "contact_email",
]);

let templates = [];
let currentIndex = -1;
let draft = null;
let draftDirty = false;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#a53f3f" : "#6d655e";
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasMonthRangeInOptionsDynamic(od) {
  if (!od || typeof od !== "object") {
    return false;
  }
  return Number.isFinite(od.monthsBefore) || Number.isFinite(od.monthsAfter);
}

function getSelectDynamicMode(field) {
  const od = field.optionsDynamic;
  if (!od) {
    return "";
  }
  if (od === "months") {
    return "months";
  }
  if (typeof od === "object" && od.type === "months") {
    return hasMonthRangeInOptionsDynamic(od) ? "months" : "advanced";
  }
  return "advanced";
}

function getMonthPresetValues(field) {
  const od = field.optionsDynamic;
  if (od === "months") {
    return { monthsBefore: 1, monthsAfter: 0, format: "monthYear", locale: "" };
  }
  if (od && typeof od === "object" && od.type === "months" && hasMonthRangeInOptionsDynamic(od)) {
    return {
      monthsBefore: Number.isFinite(od.monthsBefore) ? od.monthsBefore : 0,
      monthsAfter: Number.isFinite(od.monthsAfter) ? od.monthsAfter : 0,
      format: od.format || "monthYear",
      locale: od.locale ? String(od.locale) : "",
    };
  }
  return { monthsBefore: 1, monthsAfter: 0, format: "monthYear", locale: "" };
}

function applyMonthPresetToField(field, preset) {
  const next = {
    type: "months",
    monthsBefore: Math.max(0, Math.floor(Number(preset.monthsBefore) || 0)),
    monthsAfter: Math.max(0, Math.floor(Number(preset.monthsAfter) || 0)),
    format: preset.format || "monthYear",
  };
  const localeTrimmed = (preset.locale || "").trim();
  if (localeTrimmed) {
    next.locale = localeTrimmed;
  }
  field.optionsDynamic = next;
}

function refreshMonthPresetPreview(previewSelect, field) {
  const built = window.MonthDynamicOptions.buildDynamicMonthOptions(field.optionsDynamic);
  previewSelect.innerHTML = "";
  built.forEach((label) => {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    previewSelect.appendChild(opt);
  });
}

function templatesArrayFromImportPayload(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.templates)) {
    return parsed.templates;
  }
  throw new Error("Import file must contain a JSON array or an object with a templates array.");
}

function normalizeTemplates(data) {
  if (!Array.isArray(data)) {
    throw new Error("Templates must be a JSON array.");
  }
  data.forEach((template, index) => {
    if (!template.id || !template.subject || !template.body) {
      throw new Error(`Template at index ${index} must include id, subject, and body.`);
    }
    if (!Array.isArray(template.fields)) {
      template.fields = [];
    }
    template.fields.forEach((field) => {
      if (field.type === "select") {
        if (field.optionsDynamic && !Array.isArray(field.options)) {
          field.options = field.options || [];
        }
      }
    });
  });
  return data;
}

function cleanTemplate(template) {
  const cleanFields = Array.isArray(template.fields)
    ? template.fields.map((field) => {
        const cleaned = { ...field };
        Object.keys(cleaned).forEach((key) => {
          if (key.startsWith("_")) {
            delete cleaned[key];
          }
        });
        return cleaned;
      })
    : [];
  return { ...template, fields: cleanFields };
}

function getWorkingTemplates() {
  const working = templates.map((template) => deepClone(template));
  if (draft && currentIndex >= 0) {
    working[currentIndex] = deepClone(draft);
  }
  return working.map(cleanTemplate);
}

function renderTemplateList() {
  templatesList.innerHTML = "";
  const working = getWorkingTemplates();

  if (working.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No templates yet.";
    templatesList.appendChild(empty);
    return;
  }

  working.forEach((template, index) => {
    const item = document.createElement("li");
    if (index === currentIndex) {
      item.classList.add("active");
    }

    const title = document.createElement("div");
    title.className = "template-title";
    title.textContent = template.name || template.id || `Template ${index + 1}`;

    const meta = document.createElement("div");
    meta.className = "template-meta";
    meta.textContent = template.id || "(missing id)";

    const controls = document.createElement("div");
    controls.className = "template-controls";

    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.textContent = "Up";
    moveUp.className = "ghost";
    moveUp.disabled = index === 0;
    moveUp.addEventListener("click", (event) => {
      event.stopPropagation();
      moveTemplate(index, -1);
    });

    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.textContent = "Down";
    moveDown.className = "ghost";
    moveDown.disabled = index === working.length - 1;
    moveDown.addEventListener("click", (event) => {
      event.stopPropagation();
      moveTemplate(index, 1);
    });

    controls.appendChild(moveUp);
    controls.appendChild(moveDown);

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(controls);

    item.addEventListener("click", () => selectTemplate(index));
    templatesList.appendChild(item);
  });
}

function ensureDraftSavedBeforeSwitch(nextIndex) {
  if (!draftDirty || nextIndex === currentIndex) {
    return true;
  }
  const confirmed = window.confirm("You have unsaved changes. Discard them?");
  if (!confirmed) {
    return false;
  }
  draftDirty = false;
  if (currentIndex >= 0 && templates[currentIndex]) {
    draft = deepClone(templates[currentIndex]);
  }
  return true;
}

function selectTemplate(index) {
  if (!ensureDraftSavedBeforeSwitch(index)) {
    return;
  }
  currentIndex = index;
  draft = templates[index] ? deepClone(templates[index]) : null;
  draftDirty = false;
  renderTemplateList();
  renderEditor();
}

function renderEditor() {
  const current = draft;
  const disabled = !current;

  editorTitle.textContent = current ? "Template details" : "Select a template";
  deleteTemplateButton.disabled = disabled;

  [
    templateIdInput,
    templateNameInput,
    templateSubjectInput,
    subjectInsertSelect,
    addFieldButton,
    bodyEditor,
    bodyInsertSelect,
  ].forEach((el) => {
    if (el) {
      el.disabled = disabled;
    }
  });

  if (!current) {
    templateIdInput.value = "";
    templateNameInput.value = "";
    templateSubjectInput.value = "";
    bodyEditor.innerHTML = "";
    fieldsContainer.innerHTML = "";
    bodyPreview.textContent = "";
    warningsList.innerHTML = "";
    updateInsertOptions([]);
    updateJsonPanel();
    return;
  }

  templateIdInput.value = current.id || "";
  templateNameInput.value = current.name || "";
  templateSubjectInput.value = current.subject || "";
  bodyEditor.innerHTML = window.HTMLSanitize.sanitizeHtmlForEditor(current.body || "");
  renderFields(current);
  updateInsertOptions(current.fields || []);
  updatePreview();
  updateWarnings();
  updateJsonPanel();
}

function renderFields(current) {
  fieldsContainer.innerHTML = "";
  const fields = Array.isArray(current.fields) ? current.fields : [];

  fields.forEach((field, index) => {
    const row = document.createElement("div");
    row.className = "field-row";

    const idInput = createFieldInput("Field id", field.id || "");
    idInput.input.addEventListener("input", (event) => {
      field.id = event.target.value.trim();
      markDirty();
    });

    const labelInput = createFieldInput("Label", field.label || "");
    labelInput.input.addEventListener("input", (event) => {
      field.label = event.target.value;
      markDirty();
    });

    const typeSelect = document.createElement("select");
    ["text", "select", "calculateSalary"].forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type === "calculateSalary" ? "Calculate salary" : type;
      typeSelect.appendChild(option);
    });
    typeSelect.value = field.type || "text";
    const typeWrapper = wrapField("Type", typeSelect);
    typeSelect.addEventListener("change", (event) => {
      field.type = event.target.value;
      if (field.type !== "select") {
        delete field.options;
        delete field.optionsDynamic;
      }
      if (field.type !== "text") {
        delete field.defaultValue;
      }
      if (field.type === "calculateSalary") {
        if (field.timeFieldId === undefined) {
          field.timeFieldId = "";
        }
        if (field.rateFieldId === undefined) {
          field.rateFieldId = "";
        }
      } else {
        delete field.timeFieldId;
        delete field.rateFieldId;
      }
      markDirty();
      renderFields(current);
    });

    const requiredInput = document.createElement("input");
    requiredInput.type = "checkbox";
    requiredInput.checked = Boolean(field.required);
    const requiredWrapper = wrapField("Required", requiredInput);
    requiredInput.addEventListener("change", (event) => {
      field.required = event.target.checked;
      markDirty();
    });

    row.appendChild(idInput.wrapper);
    row.appendChild(labelInput.wrapper);
    row.appendChild(typeWrapper);
    row.appendChild(requiredWrapper);

    if (field.type === "text") {
      const defaultInput = createFieldInput(
        "Default value",
        field.defaultValue != null ? String(field.defaultValue) : "",
      );
      defaultInput.input.addEventListener("input", (event) => {
        const raw = event.target.value;
        if (raw === "") {
          delete field.defaultValue;
        } else {
          field.defaultValue = raw;
        }
        markDirty();
      });
      row.appendChild(defaultInput.wrapper);
    }

    if (field.type === "select") {
      const optionsInput = document.createElement("input");
      optionsInput.type = "text";
      optionsInput.placeholder = "Comma-separated options";
      optionsInput.value = Array.isArray(field.options) ? field.options.join(", ") : "";
      optionsInput.addEventListener("input", (event) => {
        field.options = event.target.value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        markDirty();
      });

      const dynamicSelect = document.createElement("select");
      [
        { value: "", label: "No dynamic options" },
        { value: "months", label: "Months preset" },
        { value: "advanced", label: "Advanced JSON" },
      ].forEach((optionConfig) => {
        const option = document.createElement("option");
        option.value = optionConfig.value;
        option.textContent = optionConfig.label;
        dynamicSelect.appendChild(option);
      });

      const dynamicMode = getSelectDynamicMode(field);
      dynamicSelect.value = dynamicMode;

      const dynamicWrapper = wrapField("Dynamic options", dynamicSelect);

      dynamicSelect.addEventListener("change", (event) => {
        const value = event.target.value;
        if (!value) {
          delete field.optionsDynamic;
        } else if (value === "months") {
          applyMonthPresetToField(field, {
            monthsBefore: 1,
            monthsAfter: 0,
            format: "monthYear",
            locale: "",
          });
        } else if (value === "advanced") {
          field.optionsDynamic =
            field.optionsDynamic && typeof field.optionsDynamic === "object"
              ? field.optionsDynamic
              : {};
        }
        markDirty();
        renderFields(current);
      });

      row.appendChild(wrapField("Options", optionsInput));
      row.appendChild(dynamicWrapper);

      if (dynamicSelect.value === "months") {
        const preset = getMonthPresetValues(field);

        const monthsBeforeInput = document.createElement("input");
        monthsBeforeInput.type = "number";
        monthsBeforeInput.min = "0";
        monthsBeforeInput.step = "1";
        monthsBeforeInput.value = String(preset.monthsBefore);
        const monthsBeforeWrapper = wrapField("Months before", monthsBeforeInput);

        const monthsAfterInput = document.createElement("input");
        monthsAfterInput.type = "number";
        monthsAfterInput.min = "0";
        monthsAfterInput.step = "1";
        monthsAfterInput.value = String(preset.monthsAfter);
        const monthsAfterWrapper = wrapField("Months after", monthsAfterInput);

        const formatSelect = document.createElement("select");
        [
          { value: "monthYear", label: "Month and year" },
          { value: "month", label: "Month only" },
          { value: "shortMonth", label: "Short month" },
          { value: "shortMonthYear", label: "Short month and year" },
        ].forEach((optionConfig) => {
          const option = document.createElement("option");
          option.value = optionConfig.value;
          option.textContent = optionConfig.label;
          formatSelect.appendChild(option);
        });
        formatSelect.value = preset.format;
        const formatWrapper = wrapField("Month format", formatSelect);

        const localeInput = document.createElement("input");
        localeInput.type = "text";
        localeInput.placeholder = "e.g. pl-PL (optional)";
        localeInput.value = preset.locale;
        const localeWrapper = wrapField("Locale", localeInput);

        const previewSelect = document.createElement("select");
        previewSelect.disabled = true;
        previewSelect.setAttribute("aria-label", "Preview of month options");
        const previewWrapper = wrapField("Preview", previewSelect);
        previewWrapper.classList.add("full-width");

        const pushPresetFromInputs = () => {
          applyMonthPresetToField(field, {
            monthsBefore: monthsBeforeInput.value,
            monthsAfter: monthsAfterInput.value,
            format: formatSelect.value,
            locale: localeInput.value,
          });
          refreshMonthPresetPreview(previewSelect, field);
        };

        monthsBeforeInput.addEventListener("input", () => {
          pushPresetFromInputs();
          markDirty();
        });
        monthsAfterInput.addEventListener("input", () => {
          pushPresetFromInputs();
          markDirty();
        });
        formatSelect.addEventListener("change", () => {
          pushPresetFromInputs();
          markDirty();
        });
        localeInput.addEventListener("input", () => {
          pushPresetFromInputs();
          markDirty();
        });

        refreshMonthPresetPreview(previewSelect, field);

        row.appendChild(monthsBeforeWrapper);
        row.appendChild(monthsAfterWrapper);
        row.appendChild(formatWrapper);
        row.appendChild(localeWrapper);
        row.appendChild(previewWrapper);
      }

      if (dynamicSelect.value === "advanced") {
        const advancedInput = document.createElement("textarea");
        advancedInput.rows = 4;
        advancedInput.value = JSON.stringify(field.optionsDynamic || {}, null, 2);
        advancedInput.addEventListener("input", (event) => {
          const raw = event.target.value;
          try {
            const parsed = JSON.parse(raw);
            field.optionsDynamic = parsed;
            event.target.style.borderColor = "";
          } catch (error) {
            event.target.style.borderColor = "#a53f3f";
          }
          markDirty();
        });
        const advancedWrapper = wrapField("Advanced JSON", advancedInput);
        advancedWrapper.classList.add("full-width");
        row.appendChild(advancedWrapper);
      }
    }

    if (field.type === "calculateSalary") {
      const otherFields = fields.filter((f, fieldIndex) => fieldIndex !== index && f.id);
      const timeSelect = document.createElement("select");
      const placeholderTime = document.createElement("option");
      placeholderTime.value = "";
      placeholderTime.textContent = "Select field...";
      timeSelect.appendChild(placeholderTime);
      otherFields.forEach((f) => {
        const option = document.createElement("option");
        option.value = f.id;
        option.textContent = f.label ? `${f.label} (${f.id})` : f.id;
        timeSelect.appendChild(option);
      });
      timeSelect.value = field.timeFieldId || "";
      timeSelect.addEventListener("change", (event) => {
        field.timeFieldId = event.target.value;
        markDirty();
      });
      row.appendChild(wrapField("Time field (hh:mm)", timeSelect));

      const rateSelect = document.createElement("select");
      const placeholderRate = document.createElement("option");
      placeholderRate.value = "";
      placeholderRate.textContent = "Select field...";
      rateSelect.appendChild(placeholderRate);
      otherFields.forEach((f) => {
        const option = document.createElement("option");
        option.value = f.id;
        option.textContent = f.label ? `${f.label} (${f.id})` : f.id;
        rateSelect.appendChild(option);
      });
      rateSelect.value = field.rateFieldId || "";
      rateSelect.addEventListener("change", (event) => {
        field.rateFieldId = event.target.value;
        markDirty();
      });
      row.appendChild(wrapField("Rate field (per hour)", rateSelect));
    }

    const actions = document.createElement("div");
    actions.className = "field-row-actions";
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "ghost";
    removeButton.textContent = "Remove field";
    removeButton.addEventListener("click", () => {
      current.fields.splice(index, 1);
      markDirty();
      renderFields(current);
      updateInsertOptions(current.fields || []);
    });
    actions.appendChild(removeButton);
    row.appendChild(actions);

    fieldsContainer.appendChild(row);
  });
}

function createFieldInput(label, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  return { input, wrapper: wrapField(label, input) };
}

function wrapField(labelText, input) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  const label = document.createElement("span");
  label.textContent = labelText;
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function updateInsertOptions(fields) {
  const options = Array.isArray(fields) ? fields : [];
  [subjectInsertSelect, bodyInsertSelect].forEach((select) => {
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Insert field...";
    select.appendChild(placeholder);

    options.forEach((field) => {
      if (!field.id) {
        return;
      }
      const option = document.createElement("option");
      option.value = field.id;
      option.textContent = field.label ? `${field.label} (${field.id})` : field.id;
      select.appendChild(option);
    });
  });
}

function insertAtCursor(input, text) {
  const start = input.selectionStart || 0;
  const end = input.selectionEnd || 0;
  const value = input.value || "";
  input.value = value.slice(0, start) + text + value.slice(end);
  input.selectionStart = input.selectionEnd = start + text.length;
  input.dispatchEvent(new Event("input"));
}

function insertPlaceholderIntoEditor(text) {
  bodyEditor.focus();
  document.execCommand("insertText", false, text);
}

function updatePreview() {
  bodyPreview.textContent = window.HTMLSanitize.htmlToPlainText(draft?.body || "");
}

function markDirty() {
  if (draft) {
    draft.body = bodyEditor.innerHTML;
  }
  draftDirty = true;
  renderTemplateList();
  updatePreview();
  updateWarnings();
  updateJsonPanel();
}

function collectPlaceholders(text) {
  const matches = new Set();
  const pattern = /{{\s*([^}]+?)\s*}}/g;
  let match;
  while ((match = pattern.exec(text || ""))) {
    const name = String(match[1]).trim();
    if (name) {
      matches.add(name);
    }
  }
  return matches;
}

function isContactPlaceholder(name) {
  return CONTACT_PLACEHOLDER_KEYS.has(name);
}

function updateWarnings() {
  warningsList.innerHTML = "";
  if (!draft) {
    return;
  }
  const warnings = [];

  if (!draft.id) {
    warnings.push("Template id is required.");
  }
  if (!draft.subject) {
    warnings.push("Subject is required.");
  }
  if (!draft.body) {
    warnings.push("Body is required.");
  }

  const fields = Array.isArray(draft.fields) ? draft.fields : [];
  const ids = fields.map((field) => field.id).filter(Boolean);
  const unique = new Set();
  ids.forEach((id) => {
    if (unique.has(id)) {
      warnings.push(`Duplicate field id: ${id}`);
    }
    unique.add(id);
  });
  fields.forEach((field) => {
    if (!field.id) {
      warnings.push("Each field must have an id.");
    }
    if (field.type === "select" && !field.optionsDynamic && (!Array.isArray(field.options) || field.options.length === 0)) {
      warnings.push(`Select field ${field.label || field.id || "(unnamed)"} has no options.`);
    }
    if (field.type === "calculateSalary") {
      const label = field.label || field.id || "(unnamed)";
      if (!field.timeFieldId || !field.rateFieldId) {
        warnings.push(`Calculate salary field ${label} needs both time and rate fields.`);
      }
      if (field.timeFieldId && !unique.has(field.timeFieldId)) {
        warnings.push(`Calculate salary field ${label} references unknown time field: ${field.timeFieldId}.`);
      }
      if (field.rateFieldId && !unique.has(field.rateFieldId)) {
        warnings.push(`Calculate salary field ${label} references unknown rate field: ${field.rateFieldId}.`);
      }
      if (field.id && (field.timeFieldId === field.id || field.rateFieldId === field.id)) {
        warnings.push(`Calculate salary field ${label} cannot reference itself.`);
      }
    }
  });

  const placeholderSet = new Set([...
    collectPlaceholders(draft.subject),
    ...collectPlaceholders(draft.body),
  ]);

  placeholderSet.forEach((placeholder) => {
    if (!unique.has(placeholder) && !isContactPlaceholder(placeholder)) {
      warnings.push(`Placeholder {{${placeholder}}} has no matching field.`);
    }
  });

  unique.forEach((fieldId) => {
    if (!placeholderSet.has(fieldId)) {
      warnings.push(`Field ${fieldId} is not used in subject/body.`);
    }
  });

  warnings.forEach((message) => {
    const li = document.createElement("li");
    li.textContent = message;
    warningsList.appendChild(li);
  });
}

function updateJsonPanel() {
  const preview = JSON.stringify(getWorkingTemplates(), null, 2);
  jsonPreview.textContent = preview;
  if (!document.activeElement || document.activeElement !== jsonEditor) {
    jsonEditor.value = preview;
  }
}

function applyDraftToTemplates() {
  if (draft && currentIndex >= 0) {
    templates[currentIndex] = deepClone(draft);
  }
}

function moveTemplate(index, direction) {
  if (!ensureDraftSavedBeforeSwitch(index)) {
    return;
  }
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= templates.length) {
    return;
  }
  const [moved] = templates.splice(index, 1);
  templates.splice(targetIndex, 0, moved);
  if (currentIndex === index) {
    currentIndex = targetIndex;
  } else if (currentIndex === targetIndex) {
    currentIndex = index;
  }
  renderTemplateList();
}

async function saveTemplates() {
  try {
    applyDraftToTemplates();
    const cleaned = templates.map(cleanTemplate);
    const normalized = normalizeTemplates(cleaned);
    await browser.storage.local.set({ templates: normalized });
    setStatus("Templates saved.");
    draftDirty = false;
    templates = normalized;
    renderTemplateList();
    updateJsonPanel();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to save templates.", true);
  }
}

function createNewTemplate() {
  const newTemplate = {
    id: `template_${Date.now()}`,
    name: "",
    subject: "",
    body: "",
    fields: [],
  };
  templates.push(newTemplate);
  selectTemplate(templates.length - 1);
  templateNameInput.focus();
  markDirty();
}

function deleteCurrentTemplate() {
  if (currentIndex < 0) {
    return;
  }
  const confirmed = window.confirm("Delete this template?");
  if (!confirmed) {
    return;
  }
  templates.splice(currentIndex, 1);
  currentIndex = templates.length > 0 ? Math.min(currentIndex, templates.length - 1) : -1;
  draft = currentIndex >= 0 ? deepClone(templates[currentIndex]) : null;
  draftDirty = false;
  renderTemplateList();
  renderEditor();
  updateJsonPanel();
}

function addField() {
  if (!draft) {
    return;
  }
  if (!Array.isArray(draft.fields)) {
    draft.fields = [];
  }
  draft.fields.push({ id: "", label: "", type: "text", required: false });
  markDirty();
  renderFields(draft);
}

function handleToolbarClick(event) {
  const button = event.target.closest("button");
  if (!button || !button.dataset.command) {
    return;
  }
  const command = button.dataset.command;
  if (command === "createLink") {
    const url = window.prompt("Enter URL");
    if (url) {
      document.execCommand("createLink", false, url);
      markDirty();
    }
    return;
  }
  if (command === "insertLineBreak") {
    document.execCommand("insertHTML", false, "<br>");
    markDirty();
    updateToolbarState();
    return;
  }
  document.execCommand(command, false, null);
  markDirty();
  updateToolbarState();
}

function updateToolbarState() {
  if (!toolbar) {
    return;
  }
  toolbar.querySelectorAll("button[data-command]").forEach((button) => {
    const command = button.dataset.command;
    if (command === "bold" || command === "italic") {
      const isActive = document.queryCommandState(command);
      button.classList.toggle("active", Boolean(isActive));
    } else {
      button.classList.remove("active");
    }
  });
}

function applyTemplatesFromParsedData(dataArray, successMessage) {
  const normalized = normalizeTemplates(deepClone(dataArray));
  templates = normalized;
  currentIndex = templates.length > 0 ? 0 : -1;
  draft = currentIndex >= 0 ? deepClone(templates[currentIndex]) : null;
  draftDirty = false;
  renderTemplateList();
  renderEditor();
  updateJsonPanel();
  setStatus(successMessage || "JSON applied. Click Save to persist your changes.");
}

function applyJson() {
  try {
    const parsed = JSON.parse(jsonEditor.value);
    if (!Array.isArray(parsed)) {
      throw new Error("Templates must be a JSON array.");
    }
    applyTemplatesFromParsedData(parsed);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to apply JSON.", true);
  }
}

function exportTemplatesToFile() {
  const payload = { version: 1, templates: getWorkingTemplates() };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `mail-templates-${dateStamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Templates exported.");
}

async function handleImportFileChange(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawArray = templatesArrayFromImportPayload(parsed);
    const currentCount = getWorkingTemplates().length;
    const importCount = rawArray.length;
    const shouldReplace = window.confirm(
      `Replace all ${currentCount} current template(s) with ${importCount} imported template(s)?`
    );
    if (!shouldReplace) {
      return;
    }
    applyTemplatesFromParsedData(rawArray, "Templates imported. Click Save to persist your changes.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to import templates.", true);
  }
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonPreview.textContent || "");
    setStatus("JSON copied.");
  } catch (error) {
    console.error(error);
    setStatus("Failed to copy JSON.", true);
  }
}

async function loadTemplates() {
  const data = await browser.storage.local.get("templates");
  templates = Array.isArray(data.templates) && data.templates.length > 0 ? data.templates : window.DEFAULT_TEMPLATES;
  currentIndex = templates.length > 0 ? 0 : -1;
  draft = currentIndex >= 0 ? deepClone(templates[currentIndex]) : null;
  draftDirty = false;
  renderTemplateList();
  renderEditor();
  updateJsonPanel();
}

addTemplateButton.addEventListener("click", createNewTemplate);
deleteTemplateButton.addEventListener("click", deleteCurrentTemplate);
addFieldButton.addEventListener("click", addField);

saveAllButton.addEventListener("click", saveTemplates);

[templateIdInput, templateNameInput, templateSubjectInput].forEach((input) => {
  input.addEventListener("input", (event) => {
    if (!draft) {
      return;
    }
    if (event.target === templateIdInput) {
      draft.id = event.target.value.trim();
    }
    if (event.target === templateNameInput) {
      draft.name = event.target.value;
    }
    if (event.target === templateSubjectInput) {
      draft.subject = event.target.value;
    }
    markDirty();
  });
});

subjectInsertSelect.addEventListener("change", (event) => {
  const value = event.target.value;
  if (!value) {
    return;
  }
  insertAtCursor(templateSubjectInput, `{{${value}}}`);
  event.target.value = "";
});

bodyInsertSelect.addEventListener("change", (event) => {
  const value = event.target.value;
  if (!value) {
    return;
  }
  insertPlaceholderIntoEditor(`{{${value}}}`);
  event.target.value = "";
});

bodyEditor.addEventListener("input", () => {
  if (!draft) {
    return;
  }
  draft.body = bodyEditor.innerHTML;
  markDirty();
  updateToolbarState();
});

bodyEditor.addEventListener("blur", () => {
  if (!draft) {
    return;
  }
  draft.body = bodyEditor.innerHTML;
});

bodyEditor.addEventListener("keyup", updateToolbarState);
bodyEditor.addEventListener("mouseup", updateToolbarState);
document.addEventListener("selectionchange", () => {
  if (document.activeElement === bodyEditor) {
    updateToolbarState();
  }
});

toolbar.addEventListener("click", handleToolbarClick);

applyJsonButton.addEventListener("click", applyJson);
copyJsonButton.addEventListener("click", copyJson);
exportTemplatesButton.addEventListener("click", exportTemplatesToFile);
importTemplatesButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", handleImportFileChange);

loadTemplates().catch((error) => {
  console.error(error);
  setStatus("Failed to load templates.", true);
});
