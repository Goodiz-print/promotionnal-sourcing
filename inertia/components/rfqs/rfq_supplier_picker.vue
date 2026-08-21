<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseCheckbox from '~/components/base_checkbox.vue'
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
  <section class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between">
      <h2 class="font-medium">{{ t('rfq.fields.suppliers') }}</h2>
      <span class="text-sm text-[var(--gray-6)]">
        {{ t('rfq.suppliers.selected', { count: selected.length }) }}
      </span>
    </div>

    <p v-if="options.length === 0" class="text-sm text-[var(--gray-6)]">
      {{ t('rfq.suppliers.empty') }}
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li v-for="option in options" :key="option.id">
        <BaseCheckbox
          :id="`supplier-${option.id}`"
          :model-value="selected.includes(option.id)"
          :label="option.name"
          @update:model-value="toggle(option.id, $event)"
        />
      </li>
    </ul>
  </section>
</template>
