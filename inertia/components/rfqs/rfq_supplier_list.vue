<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base_badge.vue'
import BaseButton from '~/components/base_button.vue'
import { RFQ_SUPPLIER_STATUS_TONES } from '~/components/rfqs/types'
import type { RfqSupplierType } from '#shared/types/rfq'

const props = defineProps<{
  rfqId: number
  suppliers: RfqSupplierType[]
  canManage: boolean
}>()

const { t, locale } = useI18n()

/**
 * Un destinataire déjà notifié n'est plus retirable : cela effacerait la trace
 * de l'envoi. Le bouton disparaît donc dès que le statut quitte `pending`.
 */
function remove(supplier: RfqSupplierType) {
  router.delete(
    urlFor('rfqs.suppliers.destroy', {
      locale: locale.value,
      id: props.rfqId,
      supplierId: supplier.id,
    }),
    { preserveScroll: true }
  )
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <p v-if="suppliers.length === 0" class="text-sm text-[var(--gray-6)]">
    {{ t('rfq.show.noSuppliers') }}
  </p>

  <ul v-else class="flex flex-col gap-2">
    <li
      v-for="supplier in suppliers"
      :key="supplier.id"
      class="flex items-center gap-3 rounded border border-[var(--gray-3)] p-3"
    >
      <img
        v-if="supplier.logoUrl"
        :src="supplier.logoUrl"
        alt=""
        class="h-8 w-8 rounded object-cover"
      />
      <div class="flex-1">
        <p class="font-medium">{{ supplier.name }}</p>
        <p v-if="supplier.sentAt" class="text-sm text-[var(--gray-6)]">
          {{ t('rfq.show.sentAt', { date: formatDate(supplier.sentAt) }) }}
        </p>
      </div>
      <BaseBadge :tone="RFQ_SUPPLIER_STATUS_TONES[supplier.status]">
        {{ t(`rfq.supplierStatus.${supplier.status}`) }}
      </BaseBadge>
      <BaseButton
        v-if="canManage && supplier.status === 'pending'"
        variant="link"
        @click="remove(supplier)"
      >
        {{ t('rfq.show.removeSupplier') }}
      </BaseButton>
    </li>
  </ul>
</template>
