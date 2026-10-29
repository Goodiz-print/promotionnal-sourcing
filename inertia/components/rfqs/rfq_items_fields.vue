<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import type { CategoryType } from '#shared/types/category'
import { emptyRfqItem, type RfqItemFormState } from '~/components/rfqs/types'

/**
 * Lignes du besoin. Le tableau est injecté par le formulaire parent via
 * `v-model` : on le mute directement (une valeur de `defineModel` n'est pas un
 * prop, donc pas de `vue/no-mutating-props`).
 */
const items = defineModel<RfqItemFormState[]>({ required: true })

defineProps<{
  categories: CategoryType[]
  errors: Record<string, string>
}>()

const { t } = useI18n()

function add() {
  items.value = [...items.value, emptyRfqItem()]
}

function remove(index: number) {
  items.value = items.value.filter((_, position) => position !== index)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="items.length === 0" class="text-body-sm text-text-muted">
      {{ t('rfq.items.empty') }}
    </p>

    <div
      v-for="(item, index) in items"
      :key="index"
      class="flex flex-col gap-4 rounded-lg border border-hairline bg-sunken p-4"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-eyebrow text-text-muted">{{ t('rfq.items.line', { index: index + 1 }) }}</p>
        <BaseIconButton :label="t('rfq.items.remove')" @click="remove(index)">
          <Trash2 :size="18" aria-hidden="true" />
        </BaseIconButton>
      </div>

      <div class="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <BaseInput
          :id="`item-name-${index}`"
          v-model="item.name"
          :label="t('rfq.fields.itemName')"
          :error="errors[`items.${index}.name`]"
          required
        />
        <BaseInput
          :id="`item-quantity-${index}`"
          v-model="item.quantity"
          type="number"
          :min="1"
          :label="t('rfq.fields.quantity')"
          :error="errors[`items.${index}.quantity`]"
          required
        />
        <BaseInput
          :id="`item-unit-${index}`"
          v-model="item.unit"
          :label="t('rfq.fields.unit')"
          :error="errors[`items.${index}.unit`]"
        />
      </div>

      <BaseSelect
        :id="`item-category-${index}`"
        v-model="item.categoryId"
        :label="t('rfq.fields.category')"
        :error="errors[`items.${index}.categoryId`]"
      >
        <option :value="null">{{ t('rfq.fields.noCategory') }}</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name ?? category.slug }}
        </option>
      </BaseSelect>

      <BaseTextarea
        :id="`item-description-${index}`"
        v-model="item.description"
        :rows="2"
        :label="t('rfq.fields.itemDescription')"
        :error="errors[`items.${index}.description`]"
      />
    </div>

    <div>
      <BaseButton variant="secondary" size="sm" @click="add()">
        <template #icon><Plus :size="18" aria-hidden="true" /></template>
        {{ t('rfq.items.add') }}
      </BaseButton>
    </div>
  </div>
</template>
