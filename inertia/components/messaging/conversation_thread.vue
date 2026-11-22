<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { MessagesSquare, Send } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { ICON_SIZE } from '~/types/ui'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import ConversationMessage from '~/components/messaging/conversation_message.vue'
import {
  MESSAGE_MAX_LENGTH,
  THREAD_MESSAGES_LIMIT,
  type RfqThreadType,
} from '#shared/types/conversation'

/**
 * Fil d'échanges d'une demande avec un destinataire (#226), vu de l'agence ou
 * du fournisseur. Écrire poste le message (`postUrl`, redirection Inertia) : il
 * entre dans le fil puis part par mail à l'autre côté, qui peut répondre
 * depuis sa messagerie.
 */
const props = defineProps<{
  thread: RfqThreadType
  title: string
  /** Explique où part le message (relais par mail). */
  description: string
  /** Nom de l'autre côté à défaut de `thread.counterpartName` (fournisseur non abonné). */
  fallbackCounterpart: string
  postUrl: string
}>()

const { t } = useI18n()

const body = ref('')
const error = ref('')
const sending = ref(false)

const counterpartLabel = computed(() => props.thread.counterpartName ?? props.fallbackCounterpart)
const canSend = computed(() => body.value.trim().length > 0 && !sending.value)
const fieldId = computed(() => `thread-${props.thread.rfqSupplierId}-body`)

function send() {
  if (!canSend.value) return
  sending.value = true
  error.value = ''
  router.post(
    props.postUrl,
    { body: body.value },
    {
      preserveScroll: true,
      onSuccess: () => (body.value = ''),
      onError: (errors) => (error.value = errors.body ?? ''),
      onFinish: () => (sending.value = false),
    }
  )
}
</script>

<template>
  <BaseSection :title="title" :description="description">
    <div class="flex flex-col gap-5">
      <BaseAlert v-if="thread.blocked" tone="warning">
        {{ t('messaging.thread.blocked') }}
      </BaseAlert>
      <BaseAlert v-else-if="thread.closed" tone="neutral">
        {{ t('messaging.thread.closed') }}
      </BaseAlert>

      <p v-if="thread.hasOlder" class="text-body-sm text-text-secondary">
        {{ t('messaging.thread.hasOlder', { count: THREAD_MESSAGES_LIMIT }) }}
      </p>

      <ol v-if="thread.messages.length" class="flex flex-col gap-4">
        <ConversationMessage
          v-for="message in thread.messages"
          :key="message.id"
          :message="message"
          :counterpart-label="counterpartLabel"
        />
      </ol>
      <BaseEmptyState
        v-else
        compact
        :icon="MessagesSquare"
        :title="t('messaging.thread.empty')"
        :description="thread.canWrite ? t('messaging.thread.emptyHint') : ''"
      />
    </div>

    <template v-if="thread.canWrite" #footer>
      <form class="flex flex-col gap-3" @submit.prevent="send()">
        <BaseTextarea
          :id="fieldId"
          v-model="body"
          :rows="3"
          :label="t('messaging.thread.bodyLabel')"
          :placeholder="t('messaging.thread.placeholder')"
          :error="error"
          :hint="t('messaging.thread.maxLength', { max: MESSAGE_MAX_LENGTH })"
        />
        <div class="flex justify-end">
          <BaseButton type="submit" :loading="sending" :disabled="!canSend">
            <template #icon><Send :size="ICON_SIZE" aria-hidden="true" /></template>
            {{ t('messaging.thread.send') }}
          </BaseButton>
        </div>
      </form>
    </template>
  </BaseSection>
</template>
