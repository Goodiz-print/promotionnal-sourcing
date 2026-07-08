import { configApp } from '@adonisjs/eslint-config'
import { vue } from '@adonisjs/eslint-config/vue'

export default configApp(
  ...vue,
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
