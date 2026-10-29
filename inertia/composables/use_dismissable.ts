import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * État ouvert/fermé d'un panneau (menu, dropdown, sidebar mobile) refermé par un
 * clic en dehors de `root` ou par Échap. Le parent pose `ref="root"` sur l'élément
 * qui contient le déclencheur et le panneau.
 */
export function useDismissable(root: Ref<HTMLElement | null>) {
  const open = ref(false)

  function toggle() {
    open.value = !open.value
  }

  function close() {
    open.value = false
  }

  function onDocumentClick(event: MouseEvent) {
    if (!open.value) return
    if (root.value && !root.value.contains(event.target as Node)) close()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }

  onMounted(() => {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  })

  return { open, toggle, close }
}
