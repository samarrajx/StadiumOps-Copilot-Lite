/**
 * @file eslint.config.js
 * ESLint flat config for StadiumOps Copilot Lite.
 * Target: public/js/** and functions/**
 * Ruleset: eslint:recommended + project-specific additions for ES modules.
 */

import js from '@eslint/js';

export default [
  // -------------------------------------------------------------------------
  // Base: apply eslint:recommended to all JS files in the target directories
  // -------------------------------------------------------------------------
  {
    files: ['public/js/**/*.js', 'functions/**/*.js'],
    ...js.configs.recommended,
    rules: {
      ...js.configs.recommended.rules,

      // --- Code-quality ---
      /** Disallow unused variables (catches dead code, stale imports). */
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],

      /** Disallow var; require let/const. */
      'no-var': 'error',

      /** Require const for bindings that are never reassigned. */
      'prefer-const': 'error',

      /** Require === / !== instead of == / != (except null checks). */
      'eqeqeq': ['error', 'always', { null: 'ignore' }],

      // --- Console discipline ---
      // console.error/warn are intentional in catch blocks and error handlers;
      // all other console calls are likely debug leftovers.
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },

  // -------------------------------------------------------------------------
  // Environment globals: browser APIs for public/js, node globals for tests
  // -------------------------------------------------------------------------
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      globals: {
        window:               'readonly',
        document:             'readonly',
        navigator:            'readonly',
        console:              'readonly',
        fetch:                'readonly',
        Request:              'readonly',
        Response:             'readonly',
        URL:                  'readonly',
        requestAnimationFrame: 'readonly',
        setInterval:          'readonly',
        clearInterval:        'readonly',
        setTimeout:           'readonly',
        clearTimeout:         'readonly',
      },
    },
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      globals: {
        fetch:    'readonly',
        Request:  'readonly',
        Response: 'readonly',
        URL:      'readonly',
        Map:      'readonly',
        Set:      'readonly',
      },
    },
  },
];
