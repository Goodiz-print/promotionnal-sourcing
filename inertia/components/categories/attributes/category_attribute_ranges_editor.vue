<script setup lang="ts">
import { computed } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { toDrafts, fromDrafts, type RangeDraft } from '~/composables/use_category_attribute_ranges'
import BaseButton from '~/components/base/base_button.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import type { CategoryAttributeEditType } from '#shared/types/category'

/**
 * Éditeur des plages d'un attribut numérique : une ligne par plage (bornes min /
 * max, une borne vide est ouverte). Le tableau envoyé remplace les plages
 * existantes.
 */
const props = defineProps<{ categoryId: number; attribute: CategoryAttributeEditType }>()

const emit = defineEmits<{ saved: [] }>()

const { t, locale } = useI18n()

const form = useForm<{ ranges: RangeDraft[] }>({ ranges: toDrafts(props.attribute.ranges) })

const errors = computed(() => form.errors as Record<string, string | undefined>)

function addRange() {
  form.ranges = [...form.ranges, { minValue: '', maxValue: '' }]
}

function removeRange(index: number) {
  form.ranges = form.ranges.filter((_, position) => position !== index)
}

function setBound(index: number, key: keyof RangeDraft, value: string | number | null) {
  form.ranges = form.ranges.map((range, position) =>
    position === index ? { ...range, [key]: value === null ? '' : String(value) } : range
  )
}

function submit() {
  form.transform((data) => fromDrafts(data.ranges))
  form.patch(
    urlFor('admin.categories.attributes.ranges.update', {
      locale: locale.value,
      categoryId: props.categoryId,
      id: props.attribute.id,
    }),
    { preserveScroll: true, onSuccess: () => emit('saved') }
  )
}
</script>

<template>
  <form class="flex flex-col gap-4 py-2" @submit.prevent="submit">
    <p class="text-body-sm text-text-secondary">
      {{ t('categories.attributes.ranges.hint') }}
    </p>

    <div
      v-for="(range, index) in form.ranges"
      :key="index"
      class="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]"
    >
      <BaseInput
        :id="`range-${attribute.id}-${index}-min`"
        :model-value="range.minValue"
        type="number"
        step="any"
        :label="t('categories.attributes.ranges.min')"
        :error="errors[`ranges.${index}.minValue`]"
        @update:model-value="setBound(index, 'minValue', $event)"
      />
      <BaseInput
        :id="`range-${attribute.id}-${index}-max`"
        :model-value="range.maxValue"
        type="number"
        step="any"
        :label="t('categories.attributes.ranges.max')"
        :error="errors[`ranges.${index}.maxValue`]"
        @update:model-value="setBound(index, 'maxValue', $event)"
      />
      <div class="pt-6">
        <BaseIconButton
          :label="t('categories.attributes.ranges.remove')"
          @click="removeRange(index)"
        >
          <Trash2 :size="18" aria-hidden="true" />
        </BaseIconButton>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <BaseButton type="button" variant="secondary" size="sm" @click="addRange">
        <Plus :size="16" aria-hidden="true" />
        {{ t('categories.attributes.ranges.add') }}
      </BaseButton>
      <BaseButton type="submit" size="sm" :loading="form.processing">
        {{ t('categories.attributes.ranges.save') }}
      </BaseButton>
    </div>
  </form>
</template>
