import { test } from 'node:test';
import assert from 'node:assert/strict';

// Smoke test: verifies the Node.js test runner is configured correctly.
test('arithmetic sanity check: 1 + 1 === 2', () => {
  assert.equal(1 + 1, 2);
});
