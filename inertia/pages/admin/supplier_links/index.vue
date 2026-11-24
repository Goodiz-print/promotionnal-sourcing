<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import SupplierLinkFilters from '~/components/admin/supplier_link_filters.vue'
import SupplierLinkRow from '~/components/admin/supplier_link_row.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { Paginated } from '#shared/types/pagination'
import type {
  AdminSupplierLinkFilters,
  AdminSupplierLinkItem,
  SupplierLinkOrganizationOption,
} from '#shared/types/supplier_link'

const props = defineProps<{
  suppliers: Paginated<AdminSupplierLinkItem>
  organizationOptions: SupplierLinkOrganizationOption[]
  filters: AdminSupplierLinkFilters
}>()

const { t, locale } = useI18n()

let current = { ...props.filters }

function visit(filters: AdminSupplierLinkFilters, page = 1) {
  current = filters
  router.get(
    urlFor('admin.supplier_links.index', { locale: locale.value }),
    { status: filters.status, page },
    { preserveState: true, preserveScroll: true, only: ['suppliers', 'filters'] }
  )
}

/** Colonnes propres au filtre : proposition + choix (en attente), organisation + accord (rattachées). */
const columns = computed(() =>
  props.filters.status === 'pending' ? ['suggestion', 'organization'] : ['linkedTo', 'agreement']
)
</script>

<template>
  <Head :title="t('admin.supplierLinks.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.supplierLinks.title')"
      :description="t('admin.supplierLinks.subtitle')"
    />

    <SupplierLinkFilters :filters="filters" @change="visit" />

    <BaseAlert v-if="filters.status === 'pending'" tone="warning" data-testid="unpublished-notice">
      {{ t('admin.supplierLinks.unpublishedNotice') }}
    </BaseAlert>

    <div class="flex flex-col gap-4">
      <p class="text-tabular text-body-sm text-text-secondary">
        {{ t('admin.supplierLinks.resultsCount', { count: suppliers.meta.total }) }}
      </p>

      <BaseEmptyState
        v-if="suppliers.data.length === 0"
        :title="t(`admin.supplierLinks.empty.${filters.status}`)"
        :description="t('admin.supplierLinks.emptyDescription')"
        :icon="Link2"
      />

      <BaseTable v-else :caption="t('admin.supplierLinks.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.supplierLinks.columns.supplier') }}</th>
            <th scope="col">{{ t('admin.supplierLinks.columns.products') }}</th>
            <th v-for="column in columns" :key="column" scope="col">
              {{ t(`admin.supplierLinks.columns.${column}`) }}
            </th>
            <th scope="col">
              <span class="sr-only">{{ t('admin.supplierLinks.columns.actions') }}</span>
            </th>
          </tr>
        </template>

        <SupplierLinkRow
          v-for="supplier in suppliers.data"
          :key="supplier.id"
          :supplier="supplier"
          :organizations="organizationOptions"
        />
      </BaseTable>

      <BasePagination
        :meta="suppliers.meta"
        :previous-label="t('admin.pagination.previous')"
        :next-label="t('admin.pagination.next')"
        @change="(page) => visit(current, page)"
      />
    </div>
  </div>
</template>
