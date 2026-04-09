import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Build a minimal mock DOM element that satisfies options.js top-level bindings. */
function makeMockElement(id = "") {
  return {
    id,
    textContent: "",
    innerHTML: "",
    href: "",
    download: "",
    value: "",
    disabled: false,
    className: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {},
    options: [],
    selectedIndex: -1,
    files: null,
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    click() {},
    querySelector() { return makeMockElement(); },
    querySelectorAll() { return []; },
    focus() {},
    closest() { return null; },
    dataset: {},
    children: [],
    parentNode: null,
  };
}

function loadOptionsJs() {
  const code = readFileSync(join(root, "options/options.js"), "utf8");

  // Track anchor elements created by document.createElement("a")
  const createdAnchors = [];

  const mockDocument = {
    getElementById(id) { return makeMockElement(id); },
    querySelector() { return makeMockElement(); },
    querySelectorAll() { return []; },
    createElement(tag) {
      const el = makeMockElement(tag);
      if (tag === "a") createdAnchors.push(el);
      return el;
    },
    createRange() {
      return { selectNodeContents() {}, collapse() {} };
    },
    activeElement: makeMockElement(),
    execCommand() { return false; },
    addEventListener() {},
    getSelection() { return null; },
  };

  const mockBrowser = {
    storage: {
      local: {
        get() { return Promise.resolve({}); },
        set() { return Promise.resolve(); },
      },
    },
  };

  const ctx = {
    document: mockDocument,
    window: { DEFAULT_TEMPLATES: [] },
    browser: mockBrowser,
    console,
    Blob: class MockBlob {
      constructor(parts) { this._content = parts.join(""); }
    },
    URL: {
      createObjectURL() { return "blob:mock-url"; },
      revokeObjectURL() {},
    },
    URLSearchParams: class { get() { return null; } },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Promise,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Math,
    Set,
    Map,
    Error,
    _createdAnchors: createdAnchors,
  };

  runInContext(code, createContext(ctx));
  return ctx;
}

test("exportTemplatesToFile sets download filename with templator prefix", () => {
  const ctx = loadOptionsJs();
  // exportTemplatesToFile is defined in the script scope; access via ctx
  ctx.exportTemplatesToFile();

  const anchors = ctx._createdAnchors;
  assert.ok(anchors.length > 0, "an anchor element must have been created");

  const anchor = anchors[anchors.length - 1];
  assert.ok(
    anchor.download.startsWith("templator-"),
    `download filename '${anchor.download}' must start with 'templator-'`
  );
  assert.ok(
    anchor.download.endsWith(".json"),
    `download filename '${anchor.download}' must end with '.json'`
  );
});

test("exportTemplatesToFile download filename does not use old mail-templates prefix", () => {
  const ctx = loadOptionsJs();
  ctx.exportTemplatesToFile();

  const anchors = ctx._createdAnchors;
  const anchor = anchors[anchors.length - 1];
  assert.ok(
    !anchor.download.startsWith("mail-templates-"),
    `download filename '${anchor.download}' must not use old 'mail-templates-' prefix`
  );
});

test("exportTemplatesToFile download filename includes a date stamp", () => {
  const ctx = loadOptionsJs();
  ctx.exportTemplatesToFile();

  const anchor = ctx._createdAnchors[ctx._createdAnchors.length - 1];
  // Filename format: templator-YYYY-MM-DD.json
  const datePattern = /^templator-\d{4}-\d{2}-\d{2}\.json$/;
  assert.ok(
    datePattern.test(anchor.download),
    `download filename '${anchor.download}' must match 'templator-YYYY-MM-DD.json'`
  );
});

test("exportTemplatesToFile triggers a click on the anchor", () => {
  const ctx = loadOptionsJs();
  let clicked = false;
  // Intercept the next anchor creation
  const original = ctx.document.createElement.bind(ctx.document);
  ctx.document.createElement = (tag) => {
    const el = original(tag);
    if (tag === "a") el.click = () => { clicked = true; };
    return el;
  };

  ctx.exportTemplatesToFile();
  assert.ok(clicked, "anchor.click() must be called during export");
});

test("exportTemplatesToFile revokes the object URL after clicking", () => {
  const ctx = loadOptionsJs();
  const revokedUrls = [];
  ctx.URL.revokeObjectURL = (url) => revokedUrls.push(url);

  ctx.exportTemplatesToFile();
  assert.ok(revokedUrls.length > 0, "URL.revokeObjectURL must be called after export");
});