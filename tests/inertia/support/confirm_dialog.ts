import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

/**
 * Hôte de `useConfirm` pour les specs d'écran : un composant qui demande une
 * confirmation attend la réponse de la fenêtre, rendue par `ConfirmDialogHost`
 * dans les layouts. Import à la demande : les `vi.mock` de la spec (Inertia,
 * i18n) doivent être en place avant le chargement du composant.
 *
 * ```ts
 * const host = await mountConfirmHost()
 * await button.trigger('click')
 * await answerConfirm(host, 'cancel')
 * ```
 */
export async function mountConfirmHost(): Promise<VueWrapper> {
  const { default: ConfirmDialogHost } = await import('~/components/app/confirm_dialog_host.vue')
  return mount(ConfirmDialogHost)
}

/** Clique « Confirmer » ou « Annuler » dans la fenêtre puis laisse la visite partir. */
export async function answerConfirm(host: VueWrapper, answer: 'confirm' | 'cancel') {
  await flushPromises()
  await host.find(`[data-confirm-dialog="${answer}"]`).trigger('click')
  await flushPromises()
}
