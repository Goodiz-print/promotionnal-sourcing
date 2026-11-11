<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { PackageSearch } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import QuoteCartCheckoutForm from '~/components/quote_cart/quote_cart_checkout_form.vue'
import QuoteCartGroup from '~/components/quote_cart/quote_cart_group.vue'
import type { QuoteCartGroupType } from '#shared/types/quote_cart'

/**
 * Panier de devis : les produits groupés par fournisseur, puis la validation,
 * qui crée une demande par fournisseur joignable.
 */
const props = defineProps<{ groups: QuoteCartGroupType[]; canSend: boolean }>()

const { t, locale } = useI18n()

const supplierNames = computed(() =>
  props.groups.flatMap((group) =>
    group.supplierOrganizationId !== null ? [group.supplierName ?? ''] : []
  )
)
const catalogueUrl = computed(() => urlFor('products.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('quote_cart.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('quote_cart.title')" :description="t('quote_cart.subtitle')" />

    <BaseEmptyState
      v-if="groups.length === 0"
      :title="t('quote_cart.empty.title')"
      :description="t('quote_cart.empty.description')"
      :icon="PackageSearch"
    >
      <template #actions>
        <BaseLinkButton :href="catalogueUrl">{{ t('quote_cart.empty.browse') }}</BaseLinkButton>
      </template>
    </BaseEmptyState>

    <template v-else>
      <QuoteCartGroup
        v-for="group in groups"
        :key="group.supplierOrganizationId ?? 'unreachable'"
        :group="group"
      />
      <QuoteCartCheckoutForm
        v-if="supplierNames.length > 0"
        :supplier-names="supplierNames"
        :can-send="canSend"
      />
    </template>
  </div>
</template>
