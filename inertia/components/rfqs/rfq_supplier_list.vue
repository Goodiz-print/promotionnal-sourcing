<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { Users } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAvatar from '~/components/base/base_avatar.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import { RFQ_SUPPLIER_STATUS_TONES } from '~/components/rfqs/types'
import type { RfqSupplierType } from '#shared/types/rfq'

/**
 * Destinataires d'une demande, dans le corps d'une `BaseSection` : une ligne
 * par fournisseur (logo ou initiales, date d'envoi, statut), séparées par une
 * hairline.
 */
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

/** Deux premières initiales du nom, pour l'avatar des fournisseurs sans logo. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
}
</script>

<template>
  <BaseEmptyState
    v-if="suppliers.length === 0"
    compact
    :title="t('rfq.show.noSuppliers')"
    :icon="Users"
  />

  <ul v-else class="flex flex-col">
    <li
      v-for="supplier in suppliers"
      :key="supplier.id"
      class="flex items-center gap-3 border-b border-hairline py-3 first:pt-0 last:border-0 last:pb-0"
    >
      <img
        v-if="supplier.logoUrl"
        :src="supplier.logoUrl"
        alt=""
        class="size-8 shrink-0 rounded-md object-cover"
      />
      <BaseAvatar v-else :initials="initials(supplier.name)" size="sm" />
      <div class="flex min-w-0 flex-1 flex-col">
        <p class="truncate text-body-sm font-semibold text-text-primary">{{ supplier.name }}</p>
        <p v-if="supplier.sentAt" class="text-caption text-text-muted">
          {{ t('rfq.show.sentAt', { date: formatDate(supplier.sentAt) }) }}
        </p>
      </div>
      <BaseBadge dot :tone="RFQ_SUPPLIER_STATUS_TONES[supplier.status]">
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
