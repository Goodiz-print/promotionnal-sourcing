<script setup lang="ts">
import { ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base_input.vue'
import BaseSelect from '~/components/base_select.vue'
import BaseButton from '~/components/base_button.vue'
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

  <div class="mx-auto flex max-w-[960px] flex-col gap-8 px-6 py-12">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('suppliers.index.title') }}</h1>
      <p class="text-lg text-[var(--gray-6)]">{{ t('suppliers.index.subtitle') }}</p>
    </div>

    <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div class="flex-1">
        <BaseInput
          id="search"
          v-model="search"
          type="text"
          :label="t('suppliers.index.searchLabel')"
          :placeholder="t('suppliers.index.searchPlaceholder')"
          @update:model-value="onSearch"
        />
      </div>
      <div class="sm:w-56">
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
    </div>

    <p v-if="suppliers.data.length === 0" class="text-[var(--gray-6)]">
      {{ t('suppliers.index.empty') }}
    </p>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SupplierCard v-for="supplier in suppliers.data" :key="supplier.id" :supplier="supplier" />
    </div>

    <div v-if="suppliers.meta.lastPage > 1" class="flex items-center justify-center gap-4">
      <BaseButton
        variant="secondary"
        :disabled="suppliers.meta.currentPage <= 1"
        @click="visit(suppliers.meta.currentPage - 1)"
      >
        {{ t('suppliers.index.previous') }}
      </BaseButton>
      <span class="text-sm text-[var(--gray-6)]">
        {{ suppliers.meta.currentPage }} / {{ suppliers.meta.lastPage }}
      </span>
      <BaseButton
        variant="secondary"
        :disabled="suppliers.meta.currentPage >= suppliers.meta.lastPage"
        @click="visit(suppliers.meta.currentPage + 1)"
      >
        {{ t('suppliers.index.next') }}
      </BaseButton>
    </div>
  </div>
</template>
