<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import RfqForm from '~/components/rfqs/rfq_form.vue'
import type { CategoryType } from '#shared/types/category'
import type { RfqProductOptionType, SupplierOptionType } from '#shared/types/rfq'

defineProps<{
  categories: CategoryType[]
  supplierOptions: SupplierOptionType[]
  prefillProduct?: RfqProductOptionType
  productResults?: RfqProductOptionType[]
  productSearchUnavailable?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('rfq.create.title')" />

  <div class="mx-auto max-w-[720px] px-6 py-12">
    <h1 class="mb-8 text-[28px] tracking-[-0.5px]">{{ t('rfq.create.title') }}</h1>
    <RfqForm
      mode="create"
      :categories="categories"
      :supplier-options="supplierOptions"
      :prefill="prefillProduct"
      :product-results="productResults"
      :product-search-unavailable="productSearchUnavailable"
    />
  </div>
</template>
