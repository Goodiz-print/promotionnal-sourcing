<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import type { SupplierOptionType } from '#shared/types/rfq'

/**
 * Sélection des destinataires. La liste ne contient que des organisations
 * fournisseuses actives — la même règle que celle appliquée à
 * l'enregistrement, pour ne pas proposer un choix qui serait refusé.
 */
const selected = defineModel<number[]>({ required: true })

/**
 * `options` ne contient que des fournisseurs **sélectionnables** : l'écran de
 * détail en retire ceux déjà destinataires plutôt que de les afficher cochés et
 * inertes.
 */
defineProps<{ options: SupplierOptionType[] }>()

const { t } = useI18n()

function toggle(id: number, checked: boolean) {
  selected.value = checked
    ? [...selected.value, id]
    : selected.value.filter((current) => current !== id)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="options.length === 0" class="text-body-sm text-text-muted">
      {{ t('rfq.suppliers.empty') }}
    </p>

    <ul v-else class="grid gap-2 sm:grid-cols-2">
      <li
        v-for="option in options"
        :key="option.id"
        class="rounded-lg border px-3.5 py-2.5 transition-colors duration-150"
        :class="
          selected.includes(option.id)
            ? 'border-indigo-500 bg-brand-subtle'
            : 'border-hairline bg-card hover:border-strong'
        "
      >
        <BaseCheckbox
          :id="`supplier-${option.id}`"
          :model-value="selected.includes(option.id)"
          :label="option.name"
          @update:model-value="toggle(option.id, $event)"
        />
      </li>
    </ul>

    <p class="text-caption text-text-muted">
      {{ t('rfq.suppliers.selected', { count: selected.length }) }}
    </p>
  </div>
</template>
