// ============================================================================
// eslint.config.js — configuração do ESLint (formato "flat config", ESLint 9+)
// ----------------------------------------------------------------------------
// Substitui o antigo .eslintrc.json com as MESMAS regras. Usado por
// `npm run lint` localmente e pelo job "Lint (ESLint)" do ci.yml.
// ============================================================================
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // Equivalente ao antigo ignorePatterns.
  { ignores: ['node_modules/', 'docs/', '**/*.min.js', 'src/public/'] },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },   // antigo env: { node: true }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
];
