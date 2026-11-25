import { onBeforeUnmount, ref } from 'vue'

/* Délai avant l'ouverture : évite de déplier le menu quand le pointeur ne fait que le traverser. */
export const SIDEBAR_PEEK_DELAY_MS = 150

/**
 * Aperçu temporaire de la sidebar réduite : au survol, le rail se déplie par-dessus le
 * contenu, puis se replie quand le pointeur sort. Le choix mémorisé (`useSidebarCollapsed`)
 * n'est pas modifié.
 */
export function useSidebarPeek() {
  const peeking = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function enter() {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      peeking.value = true
    }, SIDEBAR_PEEK_DELAY_MS)
  }

  /* Aussi appelé lors d'un clic sur le bouton réduire/déplier : sans ça, réduire le menu
     pointeur dessus le rouvrirait aussitôt en aperçu. */
  function leave() {
    clearTimer()
    peeking.value = false
  }

  onBeforeUnmount(clearTimer)

  return { peeking, enter, leave }
}
