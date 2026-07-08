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
export function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
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
