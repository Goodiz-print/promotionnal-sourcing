<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base_input.vue'
import BaseSelect from '~/components/base_select.vue'
import BaseTextarea from '~/components/base_textarea.vue'
import BaseButton from '~/components/base_button.vue'
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
  <section class="flex flex-col gap-4">
    <h2 class="font-medium">{{ t('rfq.items.title') }}</h2>

    <p v-if="items.length === 0" class="text-sm text-[var(--gray-6)]">
      {{ t('rfq.items.empty') }}
    </p>

    <div
      v-for="(item, index) in items"
      :key="index"
      class="flex flex-col gap-3 rounded border border-[var(--gray-3)] p-4"
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <BaseInput
          :id="`item-name-${index}`"
          v-model="item.name"
          :label="t('rfq.fields.itemName')"
          :error="errors[`items.${index}.name`]"
        />
        <BaseInput
          :id="`item-quantity-${index}`"
          v-model="item.quantity"
          type="number"
          :min="1"
          :label="t('rfq.fields.quantity')"
          :error="errors[`items.${index}.quantity`]"
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

      <div>
        <BaseButton variant="link" @click="remove(index)">{{ t('rfq.items.remove') }}</BaseButton>
      </div>
    </div>

    <div>
      <BaseButton variant="secondary" @click="add()">{{ t('rfq.items.add') }}</BaseButton>
    </div>
  </section>
</template>
