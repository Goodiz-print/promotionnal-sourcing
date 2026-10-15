import { vi } from 'vitest'
import { reactive } from 'vue'

/**
 * Briques communes aux mocks Inertia des specs Vitest. Un `vi.mock` est hoisté
 * au-dessus des imports : on l'utilise donc avec une factory asynchrone qui
 * importe ce module à la demande.
 *
 * ```ts
 * vi.mock('@inertiajs/vue3', async () => {
 *   const m = await import('./support/inertia_mocks')
 *   return { usePage: () => m.inertiaPage(translations), useForm: m.makeUseForm(), Head: m.HeadStub }
 * })
 * ```
 *
 * `translations` (propre à chaque spec) n'est lu qu'à l'appel de `usePage`, donc
 * après l'initialisation du module de test.
 */

/** Props partagées d'une page Inertia : locale active et dictionnaire `t()`. */
export function inertiaPage(translations: Record<string, string>) {
  return { props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }
}

/**
 * `useForm` factice : l'état du formulaire est réactif, les méthodes d'envoi
 * sont des `vi.fn()`. Un spec qui veut asserter un appel passe son propre espion
 * (`makeUseForm({ post })`).
 */
export function makeUseForm(methods: Record<string, unknown> = {}) {
  return (data: Record<string, unknown>) =>
    reactive({
      ...data,
      errors: {},
      processing: false,
      transform() {
        return this
      },
      reset: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      ...methods,
    })
}

/** `<Head>` sans effet : le titre de page n'est pas ce que les specs vérifient. */
export const HeadStub = { render: () => null }

/** `<Link>` d'`@adonisjs/inertia/vue` réduit à un `<a>` qui rend son contenu. */
export const LinkStub = { template: '<a><slot /></a>' }
