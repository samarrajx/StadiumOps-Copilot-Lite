/**
 * @file dom.test.js
 * Tests for /public/js/utils/dom.js
 *
 * jsdom is used to provide browser globals (document, HTMLElement) in Node.
 * We patch globalThis BEFORE dynamically importing dom.js so the module sees
 * the correct `document` reference when its exported functions execute.
 * Top-level await is valid here because this file is an ES module
 * ("type":"module" in package.json).
 */

import { JSDOM } from 'jsdom';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// 1. Bootstrap jsdom environment before importing dom.js
// ---------------------------------------------------------------------------
const { window: jsDomWindow } = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.document = jsDomWindow.document;
// Node is used for the nodeType duck-type check inside dom.js
globalThis.Node = jsDomWindow.Node;

// Dynamic import so globalThis.document is set first (static imports are hoisted).
const { el, clearChildren, setText } = await import('../public/js/utils/dom.js');

// ---------------------------------------------------------------------------
// el — element creation
// ---------------------------------------------------------------------------

test('el: creates an element with the correct tag name', () => {
  const div = el('div');
  assert.equal(div.tagName.toLowerCase(), 'div');
});

test('el: sets attributes via setAttribute (not innerHTML)', () => {
  const btn = el('button', { id: 'gate-btn', class: 'primary', 'aria-label': 'Open gate' });
  assert.equal(btn.getAttribute('id'),         'gate-btn');
  assert.equal(btn.getAttribute('class'),      'primary');
  assert.equal(btn.getAttribute('aria-label'), 'Open gate');
});

test('el: string children become text nodes (not innerHTML)', () => {
  const p = el('p', {}, ['Hello, World!']);
  // The child must be a Text node, NOT an Element created by HTML parsing
  assert.equal(p.childNodes.length, 1);
  assert.equal(p.childNodes[0].nodeType, jsDomWindow.Node.TEXT_NODE);
  assert.equal(p.textContent, 'Hello, World!');
});

test('el: HTMLElement children are appended directly', () => {
  const inner = el('span', {}, ['inner text']);
  const outer = el('div', {}, [inner]);
  assert.equal(outer.childNodes.length, 1);
  assert.equal(outer.firstChild.tagName.toLowerCase(), 'span');
  assert.equal(outer.firstChild.textContent, 'inner text');
});

test('el: mixes string and element children in order', () => {
  const span = el('span', {}, ['B']);
  const div  = el('div', {}, ['A', span, 'C']);
  assert.equal(div.childNodes.length, 3);
  assert.equal(div.childNodes[0].textContent, 'A');
  assert.equal(div.childNodes[1].tagName.toLowerCase(), 'span');
  assert.equal(div.childNodes[2].textContent, 'C');
});

test('el: skips null and undefined children without throwing', () => {
  const div = el('div', {}, [null, 'valid', undefined]);
  assert.equal(div.childNodes.length, 1);
  assert.equal(div.textContent, 'valid');
});

test('el: skips attrs with null/undefined values', () => {
  const div = el('div', { id: 'ok', 'data-x': null, class: undefined });
  assert.equal(div.getAttribute('id'), 'ok');
  assert.equal(div.hasAttribute('data-x'), false);
  assert.equal(div.hasAttribute('class'),  false);
});

test('el: no attrs / no children returns an empty element', () => {
  const section = el('section');
  assert.equal(section.tagName.toLowerCase(), 'section');
  assert.equal(section.childNodes.length, 0);
  assert.equal(section.attributes.length, 0);
});

// ---------------------------------------------------------------------------
// clearChildren
// ---------------------------------------------------------------------------

test('clearChildren: removes all child nodes', () => {
  const parent = el('ul', {}, [
    el('li', {}, ['item 1']),
    el('li', {}, ['item 2']),
    el('li', {}, ['item 3']),
  ]);
  assert.equal(parent.childNodes.length, 3);
  clearChildren(parent);
  assert.equal(parent.childNodes.length, 0);
});

test('clearChildren: is a no-op on an already-empty node', () => {
  const div = el('div');
  assert.doesNotThrow(() => clearChildren(div));
  assert.equal(div.childNodes.length, 0);
});

// ---------------------------------------------------------------------------
// setText
// ---------------------------------------------------------------------------

test('setText: sets textContent to the given string', () => {
  const div = el('div');
  setText(div, 'Gate A — 3 min wait');
  assert.equal(div.textContent, 'Gate A — 3 min wait');
});

test('setText: sets textContent to "" for null and undefined', () => {
  const span = el('span', {}, ['old content']);
  setText(span, null);
  assert.equal(span.textContent, '');

  const span2 = el('span', {}, ['old']);
  setText(span2, undefined);
  assert.equal(span2.textContent, '');
});

test('setText: coerces numbers to string', () => {
  const td = el('td');
  setText(td, 42);
  assert.equal(td.textContent, '42');
});
