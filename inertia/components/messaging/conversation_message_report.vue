<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Flag } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { MESSAGE_REPORT_REASONS, type MessageReportReason } from '#shared/types/conversation'

/**
 * Signalement d'un message de l'autre côté (#167, `messages/:id/report`) : un
 * motif, puis le serveur répond par un message flash.
 */
const props = defineProps<{ messageId: number }>()

const { t, locale } = useI18n()

const open = ref(false)
const reason = ref<MessageReportReason>('spam')
const sending = ref(false)

function report() {
  if (sending.value) return
  sending.value = true
  router.post(
    urlFor('messages.report', { locale: locale.value, id: props.messageId }),
    { reason: reason.value },
    {
      preserveScroll: true,
      onSuccess: () => (open.value = false),
      onFinish: () => (sending.value = false),
    }
  )
}
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <BaseButton v-if="!open" variant="link" size="sm" @click="open = true">
      <template #icon><Flag :size="16" aria-hidden="true" /></template>
      {{ t('messaging.thread.report.action') }}
    </BaseButton>
    <div v-else class="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
      <BaseSelect
        :id="`report-reason-${messageId}`"
        v-model="reason"
        :label="t('messaging.thread.report.reasonLabel')"
      >
        <option v-for="value in MESSAGE_REPORT_REASONS" :key="value" :value="value">
          {{ t(`messaging.thread.report.reasons.${value}`) }}
        </option>
      </BaseSelect>
      <div class="flex gap-2">
        <BaseButton variant="danger" size="sm" :loading="sending" @click="report()">
          {{ t('messaging.thread.report.submit') }}
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="open = false">
          {{ t('messaging.thread.report.cancel') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
