/**
 * @file dom.js
 * Safe DOM construction utilities.
 *
 * These are the ONLY sanctioned way for panels to build DOM nodes from
 * dynamic data, enforcing the P0 rule: no innerHTML with variable content.
 * String children are always converted to text nodes via createTextNode,
 * never concatenated into HTML strings.
 *
 * All functions reference the `document` global — in the browser this is the
 * window.document; in tests it is patched to a jsdom instance before import.
 */

// ---------------------------------------------------------------------------
// el
// ---------------------------------------------------------------------------

/**
 * Creates an HTMLElement with attributes and children, using only safe DOM APIs.
 *
 * @param {string}   tag                  - Valid HTML tag name.
 * @param {Object}   [attrs={}]           - Key/value pairs set via setAttribute.
 *                                          Null/undefined values are skipped.
 * @param {Array}    [children=[]]        - String values → Text nodes;
 *                                          DOM Nodes → appended directly;
 *                                          null/undefined entries → skipped.
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) {
      element.setAttribute(key, String(value));
    }
  }

  for (const child of children) {
    if (child == null) {
      continue; // skip null/undefined entries
    }
    // Duck-type check for DOM Node (nodeType is defined on all Node subtypes).
    // Avoids relying on instanceof HTMLElement which can fail across iframe/jsdom boundaries.
    if (typeof child === 'object' && typeof child.nodeType === 'number') {
      element.appendChild(child);
    } else {
      // Strings (and anything else) become text nodes — never innerHTML.
      element.appendChild(document.createTextNode(String(child)));
    }
  }

  return element;
}

// ---------------------------------------------------------------------------
// clearChildren
// ---------------------------------------------------------------------------

/**
 * Removes all child nodes from a DOM node safely.
 *
 * @param {Node} node - The parent node to empty.
 * @returns {void}
 */
export function clearChildren(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}

/**
 * Re-runs Lucide icon replacement on the page.
 * Required after dynamically rendering elements with data-lucide attributes.
 * No-ops gracefully if the lucide global is absent (e.g. in test environments).
 *
 * @returns {void}
 */
export function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ---------------------------------------------------------------------------
// setText
// ---------------------------------------------------------------------------

/**
 * Sets a node's text content, guarding against null/undefined.
 *
 * @param {Node}    node - The target DOM node.
 * @param {unknown} text - Text to set; null/undefined becomes empty string.
 * @returns {void}
 */
export function setText(node, text) {
  node.textContent = (text == null) ? '' : String(text);
}

// ---------------------------------------------------------------------------
// renderMarkdownToDOM
// ---------------------------------------------------------------------------

/**
 * Safely parses simple markdown (bold, lists) into DOM elements without innerHTML.
 * @param {string} text 
 * @returns {HTMLElement[]} Array of DOM nodes representing the parsed markdown
 */
export function renderMarkdownToDOM(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const elements = [];
  let currentUl = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isList = line.startsWith('- ') || line.startsWith('* ');
    const contentText = isList ? line.substring(2) : line;

    // Parse bold text **bold**
    const parts = contentText.split('**');
    const inlineNodes = parts.map((part, index) => {
      // Even indexes are normal text, odd indexes are bold
      if (index % 2 === 1 && part) {
        return el('strong', {}, [part]);
      }
      return document.createTextNode(part);
    });

    if (isList) {
      if (!currentUl) {
        currentUl = el('ul', { class: 'md-list' }, []);
        elements.push(currentUl);
      }
      currentUl.appendChild(el('li', {}, inlineNodes));
    } else {
      currentUl = null; // reset list
      elements.push(el('p', { class: 'md-p mt-2' }, inlineNodes));
    }
  }

  return elements;
}
