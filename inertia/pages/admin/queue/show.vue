<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import QueueStatusBadge from '~/components/admin/queue/queue_status_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminQueueJobDetail } from '#shared/types/admin_queue'

const props = defineProps<{ job: AdminQueueJobDetail }>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

function act(name: 'retry' | 'cancel') {
  if (!window.confirm(t(`admin.queue.actions.${name}Confirm`, { name: props.job.name }))) return
  router.post(
    urlFor(`admin.queue.${name}`, {
      locale: locale.value,
      queue: props.job.queue,
      id: props.job.id,
    }),
    {}
  )
}

const dash = '—'
</script>

<template>
  <Head :title="t('admin.queue.showTitle', { name: job.name })" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.queue.showTitle', { name: job.name })"
      :description="`${job.queue} · ${job.id}`"
      :back-href="urlFor('admin.queue.index', { locale })"
      :back-label="t('admin.queue.back')"
    >
      <template #meta>
        <QueueStatusBadge :status="job.status" :stuck="job.stuck" :overdue="job.overdue" />
      </template>
      <template #actions>
        <div class="flex flex-wrap gap-3">
          <BaseButton v-if="job.retryable" @click="act('retry')">
            {{ t('admin.queue.actions.retry') }}
          </BaseButton>
          <BaseButton v-if="job.cancellable" variant="secondary" @click="act('cancel')">
            {{ t('admin.queue.actions.cancel') }}
          </BaseButton>
        </div>
      </template>
    </BasePageHeader>

    <BaseSection :title="t('admin.queue.summary')">
      <dl class="grid gap-4 text-body-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt class="text-text-secondary">{{ t('admin.queue.columns.attempts') }}</dt>
          <dd class="text-tabular">{{ job.attempts }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.queue.detail.worker') }}</dt>
          <dd>{{ job.workerId ?? dash }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.queue.detail.executeAt') }}</dt>
          <dd>{{ dateTime(job.executeAt) }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.queue.detail.acquiredAt') }}</dt>
          <dd>{{ dateTime(job.acquiredAt) }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.queue.detail.finishedAt') }}</dt>
          <dd>{{ dateTime(job.finishedAt) }}</dd>
        </div>
      </dl>
    </BaseSection>

    <BaseSection :title="t('admin.queue.detail.error')">
      <p v-if="!job.fullError" class="text-body-sm text-text-secondary">
        {{ t('admin.queue.detail.noError') }}
      </p>
      <pre v-else class="overflow-x-auto text-caption whitespace-pre-wrap text-text-primary">{{
        job.fullError
      }}</pre>
    </BaseSection>

    <BaseSection
      :title="t('admin.queue.detail.payload')"
      :description="t('admin.queue.detail.payloadHint')"
    >
      <pre class="overflow-x-auto text-caption whitespace-pre-wrap text-text-primary">{{
        job.payload
      }}</pre>
    </BaseSection>
  </div>
</template>
