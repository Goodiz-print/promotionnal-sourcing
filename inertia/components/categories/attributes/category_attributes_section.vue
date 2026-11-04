<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import CategoryAttributeAddForm from '~/components/categories/attributes/category_attribute_add_form.vue'
import CategoryAttributeRow from '~/components/categories/attributes/category_attribute_row.vue'
import type { CategoryAttributeEditType, CategoryAttributeOption } from '#shared/types/category'

/**
 * Attributs rattachés directement à une catégorie (pas ceux hérités) : bascules
 * obligatoire / filtre, position, plages des attributs numériques, retrait, et
 * ajout d'un attribut pas encore associé.
 */
const props = defineProps<{
  categoryId: number
  attributes: CategoryAttributeEditType[]
  availableAttributes: CategoryAttributeOption[]
}>()

const { t } = useI18n()

const sorted = computed(() => [...props.attributes].sort((a, b) => a.position - b.position))
</script>

<template>
  <BaseSection
    :title="t('categories.attributes.title')"
    :description="t('categories.attributes.description')"
    flush
  >
    <p v-if="sorted.length === 0" class="px-6 py-5 text-body-sm text-text-muted">
      {{ t('categories.attributes.empty') }}
    </p>

    <BaseTable v-else bare :caption="t('categories.attributes.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('categories.attributes.columns.name') }}</th>
          <th scope="col">{{ t('categories.attributes.columns.type') }}</th>
          <th scope="col">{{ t('categories.attributes.columns.required') }}</th>
          <th scope="col">{{ t('categories.attributes.columns.filter') }}</th>
          <th scope="col">{{ t('categories.attributes.columns.position') }}</th>
          <th scope="col">{{ t('categories.attributes.columns.ranges') }}</th>
          <th scope="col" class="text-right">
            <span class="sr-only">{{ t('categories.attributes.columns.actions') }}</span>
          </th>
        </tr>
      </template>

      <CategoryAttributeRow
        v-for="attribute in sorted"
        :key="attribute.id"
        :category-id="categoryId"
        :attribute="attribute"
      />
    </BaseTable>

    <template #footer>
      <CategoryAttributeAddForm :category-id="categoryId" :options="availableAttributes" />
    </template>
  </BaseSection>
</template>
