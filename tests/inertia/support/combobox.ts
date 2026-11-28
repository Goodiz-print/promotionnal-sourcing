import type { VueWrapper } from '@vue/test-utils'

/** Ouvre le `BaseCombobox` d'id `id` et clique l'option de valeur `value` ('' = option vide). */
export async function chooseOption(wrapper: VueWrapper, id: string, value: string) {
  await wrapper.find(`#${id}`).trigger('click')
  await wrapper.find(`#${id}-listbox [data-value="${value}"]`).trigger('click')
}

/** Libellés des options proposées par le `BaseCombobox` d'id `id`. */
export function comboboxOptions(wrapper: VueWrapper, id: string): string[] {
  return wrapper.findAll(`#${id}-listbox [role="option"]`).map((option) => option.text())
}
