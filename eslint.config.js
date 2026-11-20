import { configApp } from '@adonisjs/eslint-config'
import { vue } from '@adonisjs/eslint-config/vue'

/**
 * Règles de lisibilité de CLAUDE.md (« Fonctions de tableau plutôt que boucles »,
 * « Fonctions simples et courtes »). En `warn` : le code existant ne les
 * respecte pas encore, le code neuf doit les respecter.
 */
const READABILITY_SYNTAX = [
  {
    selector: 'ForStatement, ForInStatement, ForOfStatement',
    message:
      'Privilégier map / filter / reduce / Map.groupBy / Object.fromEntries à une boucle (CLAUDE.md).',
  },
  {
    // Équivaut à `max-params: 3`, sans compter les constructeurs : l'injection
    // de dépendances (`@inject()`) y déclare autant de services que nécessaire.
    selector:
      ':function[params.length>3]:not(MethodDefinition[kind="constructor"] > FunctionExpression)',
    message: 'Plus de 3 paramètres : passer un objet typé (shared/types/) (CLAUDE.md).',
  },
]

const READABILITY_RULES = {
  'no-restricted-syntax': ['warn', ...READABILITY_SYNTAX],
  'complexity': ['warn', 10],
  'max-depth': ['warn', 2],
  'max-lines-per-function': ['warn', { max: 30, skipBlankLines: true, skipComments: true }],
  'no-nested-ternary': 'warn',
  'no-else-return': ['warn', { allowElseIf: false }],
}

export default configApp(
  ...vue,
  {
    name: 'readability (CLAUDE.md)',
    files: ['**/*.{ts,js,vue}'],
    ignores: ['public/**'],
    rules: READABILITY_RULES,
  },
  {
    name: 'readability in tests',
    files: ['tests/**/*.{ts,js}'],
    rules: {
      // Un `test(...)` ou un `group(...)` Japa est un callback long par nature.
      'max-lines-per-function': 'off',
      'complexity': 'off',
    },
  },
  {
    name: 'readability in declarations',
    // Groupes de routes et `up()` de migration : des déclarations, pas de la logique.
    files: ['start/routes.ts', 'start/routes/**/*.ts', 'database/migrations/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  {
    name: 'inertia-vue ts overrides',
    files: ['inertia/**/*.ts'],
    rules: {
      'vue/component-api-style': 'off',
    },
  },
  {
    name: 'shared code allowed in frontend',
    files: ['inertia/**/*.{ts,vue}'],
    rules: {
      // Le dossier "shared/" est explicitement du code partagé backend ↔ frontend
      // (types, constantes i18n…), on l'autorise donc dans les fichiers Inertia.
      '@adonisjs/no-backend-import-in-frontend': [
        'error',
        { allowed: ['#shared/*', '#shared/**'] },
      ],
    },
  }
)
