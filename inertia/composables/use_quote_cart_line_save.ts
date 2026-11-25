import type { UpdateQuoteCartItemData } from '#shared/types/quote_cart'

/** Pause de saisie avant l'enregistrement d'un champ texte. */
export const QUOTE_CART_SAVE_DELAY_MS = 600

/**
 * Regroupe les modifications d'une ligne du panier avant de les enregistrer.
 * Les changements en attente sont **fusionnés** : saisir la quantité puis la
 * note dans la même pause enregistre les deux, au lieu de ne garder que la
 * dernière. `schedule` attend la fin de la saisie ; `saveNow` (choix d'option)
 * enregistre aussitôt, avec ce qui était en attente.
 */
export function useQuoteCartLineSave(
  save: (changes: UpdateQuoteCartItemData) => void,
  delayMs = QUOTE_CART_SAVE_DELAY_MS
) {
  let pending: UpdateQuoteCartItemData = {}
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (Object.keys(pending).length === 0) return
    const changes = pending
    pending = {}
    save(changes)
  }

  function schedule(changes: UpdateQuoteCartItemData) {
    pending = { ...pending, ...changes }
    clearTimeout(timer)
    timer = setTimeout(flush, delayMs)
  }

  function saveNow(changes: UpdateQuoteCartItemData) {
    pending = { ...pending, ...changes }
    flush()
  }

  /** Abandonne ce qui est en attente (ligne retirée du panier). */
  function cancel() {
    clearTimeout(timer)
    timer = undefined
    pending = {}
  }

  return { schedule, saveNow, flush, cancel }
}
