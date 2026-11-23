<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { EyeOff, Inbox } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseAvatar from '~/components/base/base_avatar.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTable from '~/components/base/base_table.vue'
import SubscriptionUpsell from '~/components/subscription/subscription_upsell.vue'
import RfqRecipientStatusBadges from '~/components/rfqs/rfq_recipient_status_badges.vue'
import type { SupplierRfqType } from '#shared/types/rfq'
import type { SubscriptionUpsellType } from '#shared/types/subscription'

/** `upsell` : encart d'abonnement d'un fournisseur non abonné, qui ne voit pas l'agence (#220, #222). */
defineProps<{ rfqs: SupplierRfqType[]; upsell: SubscriptionUpsellType | null }>()

const { t, locale } = useI18n()

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}

/** Deux premières initiales de l'acheteur, pour les organisations sans logo. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
}
</script>

<template>
  <Head :title="t('rfq.supplier.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('rfq.supplier.index.title')"
      :description="t('rfq.supplier.index.subtitle')"
    />

    <SubscriptionUpsell v-if="upsell && rfqs.length > 0" :upsell="upsell" />

    <BaseEmptyState
      v-if="rfqs.length === 0"
      :title="t('rfq.supplier.index.empty')"
      :description="t('rfq.supplier.index.emptyDescription')"
      :icon="Inbox"
    />

    <BaseTable v-else :caption="t('rfq.supplier.index.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('rfq.supplier.index.columns.title') }}</th>
          <th scope="col">{{ t('rfq.supplier.index.columns.buyer') }}</th>
          <th scope="col" class="text-right">{{ t('rfq.supplier.index.columns.items') }}</th>
          <th scope="col">{{ t('rfq.supplier.index.columns.receivedAt') }}</th>
          <th scope="col">{{ t('rfq.supplier.index.columns.deadline') }}</th>
          <th scope="col">{{ t('rfq.supplier.index.columns.status') }}</th>
        </tr>
      </template>

      <tr v-for="rfq in rfqs" :key="rfq.id">
        <td>
          <Link
            route="supplier.rfqs.show"
            :params="{ locale, id: rfq.id }"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ rfq.title }}
          </Link>
        </td>
        <td>
          <span
            v-if="rfq.buyerName === null"
            class="inline-flex items-center gap-1.5 text-text-muted"
          >
            <EyeOff :size="14" aria-hidden="true" />
            {{ t('rfq.supplier.anonymousBuyer') }}
          </span>
          <div v-else class="flex items-center gap-2.5">
            <img
              v-if="rfq.buyerLogoUrl"
              :src="rfq.buyerLogoUrl"
              alt=""
              class="size-8 shrink-0 rounded-md bg-sunken object-cover"
            />
            <BaseAvatar v-else :initials="initials(rfq.buyerName)" size="sm" />
            <span class="truncate">{{ rfq.buyerName }}</span>
          </div>
        </td>
        <td class="text-tabular text-right">{{ rfq.itemCount }}</td>
        <td class="text-tabular whitespace-nowrap">
          <template v-if="rfq.sentAt">{{ formatDate(rfq.sentAt) }}</template>
        </td>
        <td class="text-tabular whitespace-nowrap">
          <template v-if="rfq.deadline">{{ formatDate(rfq.deadline) }}</template>
          <span v-else class="text-text-muted">{{ t('rfq.supplier.show.noDeadline') }}</span>
        </td>
        <td>
          <RfqRecipientStatusBadges
            :status="rfq.myStatus"
            :late="rfq.myLateReply"
            labels="rfq.supplier.status"
          />
        </td>
      </tr>
    </BaseTable>
  </div>
</template>
