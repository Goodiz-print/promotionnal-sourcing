import { onMounted, ref, type Ref } from 'vue'

const STORAGE_KEY = 'catalogue-facets-open'

function read(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function write(key: string, value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...read(), [key]: value }))
  } catch {
    /* stockage indisponible (navigation privée…) : l'état reste valable pour la session */
  }
}

/* État ouvert/fermé d'un groupe de filtres, mémorisé par clé entre les visites. Rendu
   à `defaultOpen` côté SSR puis restauré après le montage (évite un écart d'hydratation). */
export function useFacetOpen(key: string, defaultOpen: boolean) {
  const open: Ref<boolean> = ref(defaultOpen)

  onMounted(() => {
    const stored = read()[key]
    if (typeof stored === 'boolean') open.value = stored
  })

  function toggle() {
    open.value = !open.value
    write(key, open.value)
  }

  return { open, toggle }
}
