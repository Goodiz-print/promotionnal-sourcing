<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import { RFQ_STATUS_TONES } from '~/components/rfqs/types'
import type { RfqType } from '#shared/types/rfq'

defineProps<{ rfqs: RfqType[]; canManageRfq: boolean }>()

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('rfq.index.title')" />

  <div class="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-12">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('rfq.index.title') }}</h1>
        <p class="text-lg text-[var(--gray-6)]">{{ t('rfq.index.subtitle') }}</p>
      </div>
      <Link
        route="rfqs.create"
        :params="{ locale }"
        class="shrink-0 rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)]"
      >
        {{ t('rfq.index.new') }}
      </Link>
    </div>

    <p v-if="rfqs.length === 0" class="text-[var(--gray-6)]">{{ t('rfq.index.empty') }}</p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="rfq in rfqs"
        :key="rfq.id"
        class="flex items-center gap-4 rounded border border-[var(--gray-3)] p-4"
      >
        <div class="flex-1">
          <Link
            route="rfqs.show"
            :params="{ locale, id: rfq.id }"
            class="font-medium hover:underline"
          >
            {{ rfq.title }}
          </Link>
          <p class="mt-0.5 text-sm text-[var(--gray-6)]">
            {{ t('rfq.index.itemCount', { count: rfq.itemCount }) }} ·
            {{ t('rfq.index.supplierCount', { count: rfq.supplierCount }) }}
            <template v-if="rfq.supplierCount > 0">
              ·
              {{
                t('rfq.index.responded', {
                  responded: rfq.respondedCount,
                  total: rfq.supplierCount,
                })
              }}
            </template>
          </p>
        </div>
        <BaseBadge :tone="RFQ_STATUS_TONES[rfq.status]">
          {{ t(`rfq.status.${rfq.status}`) }}
        </BaseBadge>
      </li>
    </ul>
  </div>
</template>
