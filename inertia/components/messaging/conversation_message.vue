<script setup lang="ts">
import { computed } from 'vue'
import { Mail, Paperclip } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import ConversationMessageReport from '~/components/messaging/conversation_message_report.vue'
import { formatDateTime } from '#shared/helpers/date'
import { mailSenderLabel, messageSenderLabel } from '#shared/helpers/conversation'
import type { ConversationMessageType } from '#shared/types/conversation'

/**
 * Un message du fil (#226). Ceux de son propre côté sont alignés à droite et
 * nommés par leur auteur ; ceux de l'autre côté portent `counterpartLabel` et
 * peuvent être signalés.
 */
const props = defineProps<{
  message: ConversationMessageType
  counterpartLabel: string
}>()

const { t, locale } = useI18n()

const sender = computed(() =>
  messageSenderLabel(props.message, {
    counterpart: props.counterpartLabel,
    yourTeam: t('messaging.thread.yourTeam'),
  })
)

const mailSender = computed(() =>
  props.message.mailSender ? mailSenderLabel(props.message.mailSender) : ''
)

const sentAt = computed(() => formatDateTime(props.message.createdAt, locale.value))
</script>

<template>
  <li class="flex flex-col gap-1.5" :class="message.mine ? 'items-end' : 'items-start'">
    <div class="flex flex-wrap items-center gap-2 text-caption text-text-muted">
      <span class="font-semibold text-text-secondary">{{ sender }}</span>
      <time class="text-tabular" :datetime="message.createdAt">{{ sentAt }}</time>
      <BaseBadge v-if="message.viaMail" tone="neutral">
        <Mail :size="12" aria-hidden="true" />
        {{ t('messaging.thread.viaMail') }}
      </BaseBadge>
    </div>
    <p v-if="message.mailSender" class="text-caption text-text-muted" data-mail-sender>
      {{ mailSender }}
      <span v-if="!message.mailSender.known" class="text-warning">
        · {{ t('messaging.thread.unknownSender') }}
      </span>
    </p>
    <div
      class="max-w-[640px] rounded-lg border border-hairline px-4 py-3"
      :class="message.mine ? 'bg-brand-subtle' : 'bg-card'"
    >
      <p class="whitespace-pre-line break-words text-body-md text-text-primary">
        {{ message.body }}
      </p>
      <ul
        v-if="message.attachments.length"
        class="mt-2 flex flex-col gap-1"
        :aria-label="t('messaging.thread.attachments')"
      >
        <li
          v-for="attachment in message.attachments"
          :key="attachment.id"
          class="flex items-center gap-1.5 text-body-sm text-text-secondary"
        >
          <Paperclip :size="14" aria-hidden="true" />
          {{ attachment.filename }}
        </li>
      </ul>
    </div>
    <ConversationMessageReport v-if="!message.mine" :message-id="message.id" />
  </li>
</template>
