<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { SlidersHorizontal, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import { urlFor } from '~/client'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import CategoryAttributeRangesEditor from '~/components/categories/attributes/category_attribute_ranges_editor.vue'
import { formatRange } from '~/composables/use_category_attribute_ranges'
import type { CategoryAttributeEditType } from '#shared/types/category'

/**
 * Une ligne du tableau des attributs d'une catégorie. Les bascules et la position
 * enregistrent immédiatement (PATCH Inertia) ; l'éditeur de plages, réservé aux
 * attributs numériques, se déplie dans une seconde ligne.
 */
const props = defineProps<{ categoryId: number; attribute: CategoryAttributeEditType }>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()

const editingRanges = ref(false)

const displayName = () => props.attribute.name ?? props.attribute.slug

function pivotUrl() {
  return urlFor('admin.categories.attributes.update', {
    locale: locale.value,
    categoryId: props.categoryId,
    id: props.attribute.id,
  })
}

function patch(data: {
  isRequiredForPublication?: boolean
  isFilter?: boolean
  position?: number
}) {
  router.patch(pivotUrl(), data, { preserveScroll: true })
}

function onPosition(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isInteger(value) && value >= 0 && value !== props.attribute.position) {
    patch({ position: value })
  }
}

async function remove() {
  const confirmed = await confirm({
    message: t('categories.attributes.confirmRemove'),
    confirmLabel: t('categories.attributes.remove'),
    tone: 'danger',
  })
  if (!confirmed) return
  router.delete(
    urlFor('admin.categories.attributes.destroy', {
      locale: locale.value,
      categoryId: props.categoryId,
      id: props.attribute.id,
    }),
    { preserveScroll: true }
  )
}
</script>

<template>
  <tr>
    <td class="font-semibold text-text-primary">
      {{ displayName() }}
      <span v-if="attribute.unit" class="font-normal text-text-muted">({{ attribute.unit }})</span>
    </td>
    <td>{{ t(`attributes.types.${attribute.type}`) }}</td>
    <td>
      <BaseCheckbox
        :id="`attribute-${attribute.id}-required`"
        :model-value="attribute.isRequiredForPublication"
        @update:model-value="patch({ isRequiredForPublication: $event })"
      >
        <span class="sr-only">
          {{ t('categories.attributes.requiredFor', { name: displayName() }) }}
        </span>
      </BaseCheckbox>
    </td>
    <td>
      <BaseCheckbox
        :id="`attribute-${attribute.id}-filter`"
        :model-value="attribute.isFilter"
        @update:model-value="patch({ isFilter: $event })"
      >
        <span class="sr-only">
          {{ t('categories.attributes.filterFor', { name: displayName() }) }}
        </span>
      </BaseCheckbox>
    </td>
    <td>
      <input
        :id="`attribute-${attribute.id}-position`"
        type="number"
        min="0"
        :value="attribute.position"
        :aria-label="t('categories.attributes.positionFor', { name: displayName() })"
        class="field-control h-9 w-20"
        @change="onPosition"
      />
    </td>
    <td class="text-body-sm text-text-secondary">
      <template v-if="attribute.type === 'number'">
        <span v-if="attribute.ranges.length === 0">{{ t('categories.attributes.noRanges') }}</span>
        <span v-else>
          {{ attribute.ranges.map((range) => formatRange(range, attribute.unit)).join(' · ') }}
        </span>
      </template>
      <span v-else aria-hidden="true">–</span>
    </td>
    <td>
      <div class="flex items-center justify-end gap-2">
        <BaseIconButton
          v-if="attribute.type === 'number'"
          :label="t('categories.attributes.editRanges')"
          :active="editingRanges"
          @click="editingRanges = !editingRanges"
        >
          <SlidersHorizontal :size="18" aria-hidden="true" />
        </BaseIconButton>
        <BaseIconButton :label="t('categories.attributes.remove')" @click="remove">
          <Trash2 :size="18" aria-hidden="true" />
        </BaseIconButton>
      </div>
    </td>
  </tr>
  <tr v-if="editingRanges && attribute.type === 'number'">
    <td colspan="7" class="bg-sunken">
      <CategoryAttributeRangesEditor
        :category-id="categoryId"
        :attribute="attribute"
        @saved="editingRanges = false"
      />
    </td>
  </tr>
</template>
