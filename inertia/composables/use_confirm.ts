import { computed, shallowRef } from 'vue'
import type { ConfirmOptions } from '~/types/ui'

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (confirmed: boolean) => void
}

/**
 * Demande en cours, partagée par toute l'application : une seule fenêtre de
 * confirmation à la fois, rendue par `ConfirmDialogHost` (layouts). L'état est
 * au niveau du module, mais seul un clic le modifie : il ne bouge jamais côté SSR.
 * `settle` et `ask` agissent sur cet état (effets, pas de calcul pur) : ils
 * restent donc ici plutôt que dans `shared/helpers`.
 */
const pending = shallowRef<PendingConfirm | null>(null)

function settle(confirmed: boolean) {
  const current = pending.value
  if (!current) return
  pending.value = null
  current.resolve(confirmed)
}

/** Une nouvelle demande annule la précédente, restée sans réponse. */
function ask(options: ConfirmOptions): Promise<boolean> {
  settle(false)
  return new Promise((resolve) => {
    pending.value = { options, resolve }
  })
}

/**
 * Confirmation du design system, à la place de `window.confirm` :
 * `if (!(await confirm({ message: t('…'), tone: 'danger' }))) return`.
 */
export function useConfirm() {
  return { confirm: ask }
}

/** Côté hôte : la demande affichée et les deux réponses possibles. */
export function useConfirmHost() {
  return {
    request: computed(() => pending.value?.options ?? null),
    accept: () => settle(true),
    cancel: () => settle(false),
  }
}
