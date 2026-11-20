<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import RfqItemList from '~/components/rfqs/rfq_item_list.vue'
import SupplierRfqMetaPills from '~/components/rfqs/supplier_rfq_meta_pills.vue'
import SupplierBuyerContact from '~/components/rfqs/supplier_buyer_contact.vue'
import SubscriptionUpsell from '~/components/subscription/subscription_upsell.vue'
import { RFQ_SUPPLIER_STATUS_TONES } from '~/components/rfqs/types'
import { QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { RfqQuoteSummaryType } from '#shared/types/quote'
import type { SupplierRfqDetailType } from '#shared/types/rfq'
import type { SubscriptionUpsellType } from '#shared/types/subscription'

const props = defineProps<{
  rfq: SupplierRfqDetailType
  quote: RfqQuoteSummaryType | null
  canQuote: boolean
  /** Encart d'abonnement à la place de l'agence, masquée à un non abonné (#220, #222). */
  upsell: SubscriptionUpsellType | null
}>()

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('supplier.rfqs.index', { locale: locale.value }))

const quoteUrl = computed(() =>
  props.quote
    ? urlFor('supplier.quotes.show', { locale: locale.value, id: props.quote.id })
    : urlFor('supplier.quotes.create', { locale: locale.value, rfqId: props.rfq.id })
)

/**
 * Décliner n'a de sens que sur une demande encore ouverte et sans décision
 * prise. Le service reste seul juge : un refus revient en message flash.
 */
const canDecline = computed(
  () =>
    props.rfq.status === 'published' &&
    (props.rfq.myStatus === 'sent' || props.rfq.myStatus === 'viewed')
)

function decline() {
  if (!window.confirm(t('rfq.supplier.actions.confirmDecline'))) return
  router.post(
    urlFor('supplier.rfqs.decline', { locale: locale.value, id: props.rfq.id }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <Head :title="rfq.title" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="rfq.title"
      :back-href="indexUrl"
      :back-label="t('rfq.supplier.show.backToList')"
    >
      <template #meta>
        <BaseBadge dot :tone="RFQ_SUPPLIER_STATUS_TONES[rfq.myStatus]">
          {{ t(`rfq.supplier.status.${rfq.myStatus}`) }}
        </BaseBadge>
        <SupplierRfqMetaPills :rfq="rfq" />
      </template>
      <!-- Une seule action primaire : répondre ; un devis existant se consulte en secondaire. -->
      <template v-if="quote || canQuote" #actions>
        <BaseLinkButton v-if="quote" :href="quoteUrl" variant="secondary">
          {{ t('quote.supplier.rfq.viewQuote') }}
        </BaseLinkButton>
        <BaseLinkButton v-else :href="quoteUrl">
          {{ t('quote.supplier.rfq.respond') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <SubscriptionUpsell v-if="upsell" :upsell="upsell" />

    <BaseAlert v-if="rfq.myStatus === 'declined'" tone="danger">
      {{ t('rfq.supplier.show.declinedNotice') }}
    </BaseAlert>
    <BaseAlert v-else-if="rfq.status === 'closed'" tone="neutral">
      {{ t('rfq.supplier.show.closedNotice') }}
    </BaseAlert>
    <BaseAlert v-else-if="rfq.status === 'expired'" tone="warning">
      {{ t('rfq.supplier.show.expiredNotice') }}
    </BaseAlert>

    <!-- Coordonnées de l'agence : envoyées par le serveur aux seuls abonnés (#221). -->
    <SupplierBuyerContact v-if="rfq.buyerContact" :contact="rfq.buyerContact" />

    <BaseSection :title="t('rfq.supplier.show.needTitle')">
      <div class="flex flex-col gap-4">
        <p v-if="rfq.description" class="whitespace-pre-line text-body-md text-text-secondary">
          {{ rfq.description }}
        </p>
        <RfqItemList :items="rfq.items" />
      </div>
    </BaseSection>

    <BaseSection
      v-if="quote || canQuote || canDecline"
      :title="t('rfq.supplier.show.responseTitle')"
    >
      <div v-if="quote" class="flex flex-wrap items-center gap-3">
        <p class="text-body-sm text-text-secondary">{{ t('rfq.supplier.show.responseQuote') }}</p>
        <BaseBadge dot :tone="QUOTE_STATUS_TONES[quote.status]">
          {{ t(`quote.status.${quote.status}`) }}
        </BaseBadge>
      </div>
      <p v-else class="text-body-sm text-text-secondary">
        {{ t('rfq.supplier.show.responseOpen') }}
      </p>

      <template v-if="canDecline && !quote" #footer>
        <BaseButton variant="danger" size="sm" @click="decline()">
          {{ t('rfq.supplier.actions.decline') }}
        </BaseButton>
      </template>
    </BaseSection>
  </div>
</template>
