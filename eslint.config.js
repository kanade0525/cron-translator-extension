import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser
        document: 'readonly',
        window: 'readonly',
        MutationObserver: 'readonly',
        HTMLElement: 'readonly',
        Node: 'readonly',
        NodeFilter: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        alert: 'readonly',
        // Chrome Extension
        chrome: 'readonly',
        // Node (config files, tests)
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-cond-assign': ['error', 'except-parens'],
    },
  },
  {
    ignores: ['content.js', 'node_modules/', 'test-results/', 'coverage/'],
  },
  {
    files: ['generate_icons.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
];
