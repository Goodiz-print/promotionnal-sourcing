<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import { RFQ_SUPPLIER_STATUS_TONES } from '~/components/rfqs/types'
import type { SupplierRfqType } from '#shared/types/rfq'

defineProps<{ rfqs: SupplierRfqType[] }>()

const { t, locale } = useI18n()

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <Head :title="t('rfq.supplier.index.title')" />

  <div class="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-12">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('rfq.supplier.index.title') }}</h1>
      <p class="text-lg text-[var(--gray-6)]">{{ t('rfq.supplier.index.subtitle') }}</p>
    </div>

    <p v-if="rfqs.length === 0" class="text-[var(--gray-6)]">
      {{ t('rfq.supplier.index.empty') }}
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="rfq in rfqs"
        :key="rfq.id"
        class="flex items-center gap-4 rounded border border-[var(--gray-3)] p-4"
      >
        <img
          v-if="rfq.buyerLogoUrl"
          :src="rfq.buyerLogoUrl"
          alt=""
          class="h-10 w-10 shrink-0 rounded object-cover"
        />
        <div class="flex-1">
          <Link
            route="supplier.rfqs.show"
            :params="{ locale, id: rfq.id }"
            class="font-medium hover:underline"
          >
            {{ rfq.title }}
          </Link>
          <p class="mt-0.5 text-sm text-[var(--gray-6)]">
            {{ t('rfq.supplier.index.from', { name: rfq.buyerName }) }} ·
            {{ t('rfq.index.itemCount', { count: rfq.itemCount }) }}
            <template v-if="rfq.sentAt">
              · {{ t('rfq.supplier.index.receivedAt', { date: formatDate(rfq.sentAt) }) }}
            </template>
          </p>
          <p class="text-sm text-[var(--gray-6)]">
            {{
              rfq.deadline
                ? t('rfq.show.deadline', { date: formatDate(rfq.deadline) })
                : t('rfq.supplier.show.noDeadline')
            }}
          </p>
        </div>
        <BaseBadge :tone="RFQ_SUPPLIER_STATUS_TONES[rfq.myStatus]">
          {{ t(`rfq.supplier.status.${rfq.myStatus}`) }}
        </BaseBadge>
      </li>
    </ul>
  </div>
</template>
