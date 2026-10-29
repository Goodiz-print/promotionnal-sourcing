import { ref } from 'vue'

const STORAGE_KEY = 'app-sidebar-collapsed'

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/* État partagé par le layout et la sidebar. Lu au premier appel côté client seulement
   (le SSR rend toujours la sidebar dépliée), puis mémorisé entre les visites. */
const collapsed = ref(false)
let hydrated = false

export function useSidebarCollapsed() {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true
    collapsed.value = read()
  }

  function toggle() {
    collapsed.value = !collapsed.value
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed.value ? '1' : '0')
    } catch {
      /* stockage indisponible (navigation privée…) : l'état reste valable pour la session */
    }
  }

  return { collapsed, toggle }
}
