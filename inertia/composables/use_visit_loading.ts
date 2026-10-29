import { onBeforeUnmount, ref } from 'vue'
import { router } from '@inertiajs/vue3'

/**
 * `true` pendant qu'une visite GET Inertia recharge la page courante (filtre, recherche,
 * pagination). Les visites vers une autre page sont ignorées (la navigation prend le
 * relais) et `delay` évite le clignotement quand la réponse arrive vite.
 */
export function useVisitLoading(delay = 150) {
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const stop = () => {
    clearTimeout(timer)
    loading.value = false
  }

  const offStart = router.on('start', (event) => {
    const { visit } = event.detail
    if (visit.method !== 'get' || visit.url.pathname !== window.location.pathname) return
    timer = setTimeout(() => (loading.value = true), delay)
  })
  const offFinish = router.on('finish', stop)

  onBeforeUnmount(() => {
    offStart()
    offFinish()
    stop()
  })

  return { loading }
}
