<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from '~/i18n'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { PaginationMeta } from '#shared/types/pagination'

/**
 * Gabarit des listes de supervision : en-tête, filtres (slot), compteur, tableau
 * (slots `head` + corps) ou état vide, pagination. Émet `page` au changement de page.
 */
const props = defineProps<{
  title: string
  description: string
  countLabel: string
  emptyTitle: string
  emptyDescription: string
  icon: Component
  meta: PaginationMeta
}>()
const emit = defineEmits<{ page: [page: number] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-8">
    <BasePageHeader :title="props.title" :description="props.description" />

    <slot name="filters" />

    <div class="flex flex-col gap-4">
      <p class="text-tabular text-body-sm text-text-secondary">{{ countLabel }}</p>

      <BaseEmptyState
        v-if="meta.total === 0"
        :title="emptyTitle"
        :description="emptyDescription"
        :icon="icon"
      />
      <BaseTable v-else :caption="title">
        <template #head><slot name="head" /></template>
        <slot />
      </BaseTable>

      <BasePagination
        :meta="meta"
        :previous-label="t('admin.pagination.previous')"
        :next-label="t('admin.pagination.next')"
        @change="(page) => emit('page', page)"
      />
    </div>
  </div>
</template>
