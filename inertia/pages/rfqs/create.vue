<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
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

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('rfqs.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('rfq.create.title')" />

  <div class="mx-auto flex w-full max-w-[860px] flex-col gap-8">
    <BasePageHeader
      :title="t('rfq.create.title')"
      :description="t('rfq.create.subtitle')"
      :back-href="indexUrl"
      :back-label="t('rfq.show.backToList')"
    />

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
