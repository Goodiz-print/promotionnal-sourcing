import './css/app.css'
import 'vue-sonner/style.css'
import { client } from '~/client'
import Layout from '~/layouts/default.vue'
import { i18nPlugin } from '~/i18n'
import { createInertiaApp } from '@inertiajs/vue3'
import { TuyauProvider } from '@adonisjs/inertia/vue'
import { createSSRApp, type DefineComponent, h } from 'vue'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { pageTitle } from '#shared/helpers/page_title'

const appName = import.meta.env.VITE_APP_NAME || 'Promotional Sourcing'

createInertiaApp({
  title: (title) => pageTitle(title, appName),
  resolve: (name) => {
    return resolvePageComponent(
      `./pages/${name}.vue`,
      import.meta.glob<DefineComponent>('./pages/**/*.vue'),
      Layout
    )
  },
  setup({ el, App, props, plugin }) {
    createSSRApp({ render: () => h(TuyauProvider, { client }, { default: () => h(App, props) }) })
      .use(plugin)
      .use(i18nPlugin)
      .mount(el)
  },
  progress: {
    // Indigo de marque (--indigo-500) : la barre de progression Inertia ne lit pas les tokens CSS.
    color: '#4032c8',
  },
})
