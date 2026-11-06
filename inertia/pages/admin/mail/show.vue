<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useMailActions } from '~/composables/use_mail_actions'
import { useTradeFormat } from '~/composables/use_trade_format'
import MailStatusBadge from '~/components/admin/mail/mail_status_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminMailDetail } from '#shared/types/admin_ops'

defineProps<{ delivery: AdminMailDetail }>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()
const { retry } = useMailActions()
</script>

<template>
  <Head :title="t('admin.mail.showTitle', { kind: t(`admin.mail.kinds.${delivery.kind}`) })" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.mail.showTitle', { kind: t(`admin.mail.kinds.${delivery.kind}`) })"
      :description="delivery.to"
      :back-href="urlFor('admin.mail.index', { locale })"
      :back-label="t('admin.mail.back')"
    >
      <template #meta><MailStatusBadge :status="delivery.status" /></template>
      <template #actions>
        <BaseButton v-if="delivery.retryable" @click="retry(delivery.id)">
          {{ t('admin.mail.actions.retry') }}
        </BaseButton>
      </template>
    </BasePageHeader>

    <BaseSection :title="t('admin.mail.detail.summary')">
      <dl class="grid gap-4 text-body-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt class="text-text-secondary">{{ t('admin.mail.columns.attempts') }}</dt>
          <dd class="text-tabular">{{ delivery.attempts }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.mail.detail.createdAt') }}</dt>
          <dd>{{ dateTime(delivery.createdAt) }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.mail.detail.updatedAt') }}</dt>
          <dd>{{ dateTime(delivery.updatedAt) }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.mail.detail.sentAt') }}</dt>
          <dd>{{ dateTime(delivery.sentAt) }}</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-text-secondary">{{ t('admin.mail.detail.idempotencyKey') }}</dt>
          <dd class="break-all">{{ delivery.idempotencyKey }}</dd>
        </div>
      </dl>
    </BaseSection>

    <BaseSection :title="t('admin.mail.detail.error')">
      <p v-if="!delivery.fullError" class="text-body-sm text-text-secondary">
        {{ t('admin.mail.detail.noError') }}
      </p>
      <pre v-else class="overflow-x-auto text-caption whitespace-pre-wrap text-text-primary">{{
        delivery.fullError
      }}</pre>
    </BaseSection>
  </div>
</template>
