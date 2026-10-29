<script setup lang="ts">
import { ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Building2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import SupplierCard from '~/components/supplier_card.vue'
import type { Paginated } from '#shared/types/pagination'
import type { SupplierType, SupplierDirectoryFilters } from '#shared/types/supplier'

const props = defineProps<{
  suppliers: Paginated<SupplierType>
  filters: SupplierDirectoryFilters
  countries: string[]
}>()

const { t, locale } = useI18n()

const search = ref(props.filters.search ?? '')
const country = ref<string | null>(props.filters.country ?? null)

function visit(page: number) {
  router.get(
    urlFor('suppliers.index', { locale: locale.value }),
    { search: search.value || undefined, country: country.value || undefined, page },
    { preserveState: true, preserveScroll: true, only: ['suppliers', 'filters'] }
  )
}

let debounce: ReturnType<typeof setTimeout>
function onSearch() {
  clearTimeout(debounce)
  debounce = setTimeout(() => visit(1), 300)
}
</script>

<template>
  <Head :title="t('suppliers.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('suppliers.index.title')"
      :description="t('suppliers.index.subtitle')"
    />

    <BaseCard padding="md">
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_224px] sm:items-end">
        <BaseInput
          id="search"
          v-model="search"
          type="search"
          :label="t('suppliers.index.searchLabel')"
          :placeholder="t('suppliers.index.searchPlaceholder')"
          @update:model-value="onSearch"
        />
        <BaseSelect
          id="country"
          v-model="country"
          :label="t('suppliers.index.country')"
          @update:model-value="visit(1)"
        >
          <option :value="null">{{ t('suppliers.index.allCountries') }}</option>
          <option v-for="code in countries" :key="code" :value="code">{{ code }}</option>
        </BaseSelect>
      </div>
    </BaseCard>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <p class="text-tabular text-body-sm text-text-secondary">
          {{ t('suppliers.index.resultsCount', { count: suppliers.meta.total }) }}
        </p>
      </div>

      <BaseEmptyState
        v-if="suppliers.data.length === 0"
        :title="t('suppliers.index.empty')"
        :description="t('suppliers.index.emptyHint')"
        :icon="Building2"
      />

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SupplierCard v-for="supplier in suppliers.data" :key="supplier.id" :supplier="supplier" />
      </div>

      <BasePagination
        :meta="suppliers.meta"
        :previous-label="t('suppliers.index.previous')"
        :next-label="t('suppliers.index.next')"
        @change="visit"
      />
    </div>
  </div>
</template>
