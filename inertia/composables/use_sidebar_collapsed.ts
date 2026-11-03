import { onMounted, ref } from 'vue'

const STORAGE_KEY = 'app-sidebar-collapsed'

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/* État partagé par le layout et la sidebar. Le SSR rend toujours la sidebar dépliée : la valeur
   mémorisée n'est donc lue qu'une fois le composant monté. La lire pendant le `setup` ferait diverger
   le premier rendu client du HTML serveur, et Vue ne corrige pas les classes d'un DOM hydraté
   (la grille du layout resterait à la largeur dépliée alors que le menu est réduit). */
const collapsed = ref(false)

export function useSidebarCollapsed() {
  onMounted(() => {
    collapsed.value = read()
  })

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
