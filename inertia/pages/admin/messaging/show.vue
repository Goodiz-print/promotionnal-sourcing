<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { usePlatformPermissions } from '~/composables/use_platform_permissions'
import { useTradeFormat } from '~/composables/use_trade_format'
import ConversationBlockForm from '~/components/admin/conversation_block_form.vue'
import MessageModerationRow from '~/components/admin/message_moderation_row.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminConversationDetail } from '#shared/types/admin_messaging'

const props = defineProps<{ detail: AdminConversationDetail }>()

const { t, locale } = useI18n()
const { can } = usePlatformPermissions()
const { dateTime } = useTradeFormat()

const conversation = computed(() => props.detail.conversation)
const title = computed(
  () => conversation.value.subject ?? t('admin.messaging.untitled', { id: conversation.value.id })
)

const summary = computed(() => [
  { label: t('admin.trade.columns.buyer'), value: conversation.value.buyer.name },
  { label: t('admin.trade.columns.supplier'), value: conversation.value.supplier.name },
  { label: t('admin.messaging.columns.messages'), value: String(conversation.value.messagesCount) },
  { label: t('admin.messaging.columns.createdAt'), value: dateTime(conversation.value.createdAt) },
])
</script>

<template>
  <Head :title="title" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="title"
      :back-href="urlFor('admin.messaging.index', { locale })"
      :back-label="t('admin.messaging.back')"
    >
      <template #meta>
        <BaseBadge v-if="conversation.blockedAt" tone="danger">
          {{ t('admin.messaging.blocked') }}
        </BaseBadge>
      </template>
    </BasePageHeader>

    <BaseAlert tone="info">{{ t('admin.messaging.auditNotice') }}</BaseAlert>

    <BaseSection :title="t('admin.trade.summary')">
      <BaseDescriptionList :items="summary" />
      <p v-if="detail.blockedReason" class="mt-4 text-body-sm text-text-secondary">
        {{ t('admin.messaging.blockedReason', { reason: detail.blockedReason }) }}
      </p>
    </BaseSection>

    <BaseSection :title="t('admin.messaging.messages')" flush>
      <p v-if="!detail.messages.length" class="p-4 text-body-sm text-text-secondary">
        {{ t('admin.messaging.noMessages') }}
      </p>
      <ul v-else class="divide-y divide-hairline">
        <MessageModerationRow
          v-for="message in detail.messages"
          :key="message.id"
          :message="message"
        />
      </ul>
    </BaseSection>

    <BaseSection v-if="can('moderation.manage')" :title="t('admin.messaging.block.title')">
      <ConversationBlockForm
        :conversation-id="conversation.id"
        :blocked="!!conversation.blockedAt"
      />
    </BaseSection>
  </div>
</template>
