import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'

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

/** Parties de la fenêtre repérées par `data-confirm-dialog` (les ids, eux, viennent de `useId()`). */
export type ConfirmDialogPart = 'title' | 'message' | 'cancel' | 'confirm'

/** Élément d'une partie de la fenêtre : seul endroit qui connaît le sélecteur. */
export function confirmPart(host: VueWrapper, part: ConfirmDialogPart): DOMWrapper<Element> {
  return host.find(`[data-confirm-dialog="${part}"]`)
}

/** Texte d'une partie de la fenêtre, le message par défaut. */
export function confirmText(host: VueWrapper, part: ConfirmDialogPart = 'message'): string {
  return confirmPart(host, part).text()
}

/** Clique « Confirmer » ou « Annuler » dans la fenêtre puis laisse la visite partir. */
export async function answerConfirm(host: VueWrapper, answer: 'confirm' | 'cancel') {
  await flushPromises()
  await confirmPart(host, answer).trigger('click')
  await flushPromises()
}
