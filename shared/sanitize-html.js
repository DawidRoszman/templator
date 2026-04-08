"use strict";

function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  return doc.body?.textContent || "";
}

function sanitizeHtmlForEditor(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const body = doc.body;
  const dangerousTags = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE", "FORM"]);
  const toRemove = [];
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (dangerousTags.has(node.tagName)) {
      toRemove.push(node);
    }
    node = walker.nextNode();
  }
  toRemove.forEach((n) => n.remove());

  const walker2 = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let el = walker2.nextNode();
  while (el) {
    if (el.nodeType === Node.ELEMENT_NODE) {
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
        }
        if (
          (name === "href" || name === "src" || name === "xlink:href") &&
          /^javascript:/i.test(String(attr.value).trim())
        ) {
          el.removeAttribute(attr.name);
        }
      }
    }
    el = walker2.nextNode();
  }
  return body.innerHTML;
}

window.HTMLSanitize = {
  htmlToPlainText,
  sanitizeHtmlForEditor,
};
