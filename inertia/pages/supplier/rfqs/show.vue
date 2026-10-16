<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import RfqItemList from '~/components/rfqs/rfq_item_list.vue'
import { RFQ_SUPPLIER_STATUS_TONES } from '~/components/rfqs/types'
import type { SupplierRfqDetailType } from '#shared/types/rfq'

const props = defineProps<{ rfq: SupplierRfqDetailType }>()

const { t, locale } = useI18n()

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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <Head :title="rfq.title" />

  <div class="mx-auto flex max-w-[860px] flex-col gap-8 px-6 py-12">
    <div>
      <Link
        route="supplier.rfqs.index"
        :params="{ locale }"
        class="text-sm text-[var(--color-primary)] hover:underline"
      >
        {{ t('rfq.supplier.show.backToList') }}
      </Link>

      <div class="mt-3 flex items-start justify-between gap-4">
        <h1 class="text-[32px] tracking-[-0.5px]">{{ rfq.title }}</h1>
        <BaseBadge :tone="RFQ_SUPPLIER_STATUS_TONES[rfq.myStatus]">
          {{ t(`rfq.supplier.status.${rfq.myStatus}`) }}
        </BaseBadge>
      </div>

      <p class="mt-1 text-sm text-[var(--gray-6)]">
        {{ t('rfq.supplier.show.buyer') }} : {{ rfq.buyerName }} ·
        {{
          rfq.deadline
            ? t('rfq.show.deadline', { date: formatDate(rfq.deadline) })
            : t('rfq.supplier.show.noDeadline')
        }}
      </p>
    </div>

    <p v-if="rfq.myStatus === 'declined'" class="text-sm text-[var(--state-danger)]">
      {{ t('rfq.supplier.show.declinedNotice') }}
    </p>
    <p v-else-if="rfq.status === 'closed'" class="text-sm text-[var(--gray-6)]">
      {{ t('rfq.supplier.show.closedNotice') }}
    </p>

    <section class="flex flex-col gap-3">
      <h2 class="font-medium">{{ t('rfq.supplier.show.needTitle') }}</h2>
      <p v-if="rfq.description" class="whitespace-pre-line text-[var(--gray-8)]">
        {{ rfq.description }}
      </p>
      <RfqItemList :items="rfq.items" />
    </section>

    <div v-if="canDecline" class="flex flex-wrap items-center gap-4">
      <BaseButton variant="danger" @click="decline()">
        {{ t('rfq.supplier.actions.decline') }}
      </BaseButton>
      <!-- Le dépôt de devis est la Phase 4 (#5) : on l'annonce plutôt que de
           laisser le fournisseur chercher un bouton qui n'existe pas. -->
      <span class="text-sm text-[var(--gray-6)]">{{ t('rfq.supplier.show.quoteSoon') }}</span>
    </div>
  </div>
</template>
