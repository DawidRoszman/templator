import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Build a minimal mock DOM element. */
function makeMockElement(id = "") {
  return {
    id,
    textContent: "",
    innerHTML: "",
    value: "",
    href: "",
    download: "",
    readOnly: false,
    tabIndex: 0,
    required: false,
    type: "",
    placeholder: "",
    className: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; }, hidden: false },
    style: {},
    options: [],
    selectedIndex: -1,
    dataset: {},
    children: [],
    parentNode: null,
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    setAttribute() {},
    click() {},
    querySelector() { return makeMockElement(); },
    querySelectorAll() { return []; },
    focus() {},
    closest() { return null; },
  };
}

/**
 * Load popup.js in a vm context with controllable browser/DOM mocks.
 *
 * @param {object} opts
 * @param {object[]} opts.storedTemplates  - value for browser.storage.local.get("templates")
 * @param {object[]|null} opts.tabs        - value for browser.tabs.query (null → resolves empty)
 */
function loadPopupJs({ storedTemplates = [], tabs = [] } = {}) {
  const code = readFileSync(join(root, "popup/popup.js"), "utf8");

  // Tracked status element so we can assert on textContent changes
  const statusEl = makeMockElement("status");

  const mockDocument = {
    getElementById(id) {
      if (id === "status") return statusEl;
      return makeMockElement(id);
    },
    createElement(tag) {
      const el = makeMockElement(tag);
      return el;
    },
    querySelector() { return makeMockElement(); },
    querySelectorAll() { return []; },
    addEventListener() {},
    activeElement: makeMockElement(),
  };

  const mockBrowser = {
    storage: {
      local: {
        get() {
          return Promise.resolve({ templates: storedTemplates });
        },
      },
    },
    tabs: {
      query() {
        return Promise.resolve(tabs);
      },
    },
    compose: {
      getComposeDetails() { return Promise.resolve({ to: [] }); },
    },
    runtime: {
      openOptionsPage() { return Promise.resolve(); },
    },
  };

  const mockWindow = {
    location: { search: "" },
    DEFAULT_TEMPLATES: [],
    MonthDynamicOptions: { buildDynamicMonthOptions() { return []; } },
    SalaryField: {
      mergeSalaryFieldsIntoValues(_fields, values) { return values; },
    },
    HTMLSanitize: {
      htmlToPlainText(html) { return html || ""; },
    },
  };

  const ctx = {
    document: mockDocument,
    window: mockWindow,
    browser: mockBrowser,
    // Make window.location accessible as window.location.search
    location: mockWindow.location,
    console,
    URLSearchParams: class {
      constructor(search) { this._search = search || ""; }
      get(key) {
        const params = new URLSearchParams(this._search);
        // Simple parser: return null for missing keys
        const match = this._search.match(new RegExp(`[?&]${key}=([^&]*)`));
        return match ? match[1] : null;
      }
    },
    Promise,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Set,
    Map,
    Math,
    RegExp,
    Error,
    Date,
    JSON,
    parseInt: Number.parseInt,
    isNaN,
    isFinite,
    setTimeout,
    clearTimeout,
    _statusEl: statusEl,
  };

  // window.location.search is accessed via `window.location.search`; popup.js
  // calls `new URLSearchParams(window.location.search)` so window must expose location.
  ctx.window.location = { search: "" };

  runInContext(code, createContext(ctx));
  return ctx;
}

test("loadTemplates sets 'Open Templator' status when no compose tab is open", async () => {
  // tabs: [] means browser.tabs.query returns an empty array → tab is undefined → tabId is null
  const ctx = loadPopupJs({ storedTemplates: [], tabs: [] });

  await ctx.loadTemplates();

  assert.equal(
    ctx._statusEl.textContent,
    "Open Templator from the compose toolbar.",
    "status should prompt user to open from compose toolbar"
  );
});

test("loadTemplates sets 'Templates loaded.' status when compose tab exists", async () => {
  // tabs: [{id: 1}] means browser.tabs.query returns a tab with id=1 → tabId is 1 (not null)
  const ctx = loadPopupJs({ storedTemplates: [], tabs: [{ id: 1 }] });

  await ctx.loadTemplates();

  assert.equal(ctx._statusEl.textContent, "Templates loaded.");
});

test("loadTemplates status message does not use old 'Mail Templates' branding", async () => {
  const ctx = loadPopupJs({ storedTemplates: [], tabs: [] });

  await ctx.loadTemplates();

  assert.ok(
    !ctx._statusEl.textContent.includes("Mail Templates"),
    `status '${ctx._statusEl.textContent}' must not reference old 'Mail Templates' brand`
  );
});

test("loadTemplates falls back to DEFAULT_TEMPLATES when storage is empty", async () => {
  // Ensure loadTemplates doesn't throw when using empty default templates
  const ctx = loadPopupJs({ storedTemplates: [], tabs: [{ id: 5 }] });

  await assert.doesNotReject(() => ctx.loadTemplates());

  assert.equal(ctx._statusEl.textContent, "Templates loaded.");
});

test("popup.js source contains the updated Templator status message", () => {
  const src = readFileSync(join(root, "popup/popup.js"), "utf8");
  assert.ok(
    src.includes('"Open Templator from the compose toolbar."'),
    "source must contain updated Templator status message"
  );
  assert.ok(
    !src.includes('"Open Mail Templates from the compose toolbar."'),
    "source must not contain old Mail Templates status message"
  );
});