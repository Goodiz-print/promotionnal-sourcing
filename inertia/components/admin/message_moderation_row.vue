<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Eye, EyeOff, Flag, TriangleAlert } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import { ICON_SIZE } from '~/types/ui'
import type { AdminMessageRow } from '#shared/types/admin_messaging'

/**
 * Un message du fil avec ses signalements et les décisions possibles : masquer
 * / réafficher, avertir l'auteur, classer un signalement ouvert. Un message
 * masqué reste lisible ici (c'est la vue de modération) mais est marqué.
 */
const props = defineProps<{ message: AdminMessageRow }>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

/** Une décision à la fois : pendant la requête, tous les boutons sont désactivés. */
const processing = ref(false)

const hasOpenReport = () => props.message.reports.some((report) => report.status === 'open')

function post(route: string, id: number, confirmKey?: string) {
  if (confirmKey && !window.confirm(t(confirmKey))) return
  router.post(
    urlFor(route as 'admin.messaging.hide', { locale: locale.value, id }),
    {},
    {
      preserveScroll: true,
      onStart: () => (processing.value = true),
      onFinish: () => (processing.value = false),
    }
  )
}
</script>

<template>
  <li class="flex flex-col gap-3 p-4">
    <div class="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
      <span class="font-semibold text-text-primary">
        {{ message.authorEmail ?? t('admin.messaging.unknownAuthor') }}
      </span>
      <span>{{ dateTime(message.createdAt) }}</span>
      <BaseBadge v-if="message.hiddenAt" tone="warning">
        {{ t('admin.messaging.hidden') }}
      </BaseBadge>
    </div>

    <p class="whitespace-pre-wrap text-body-sm" :class="{ 'opacity-60': message.hiddenAt }">
      {{ message.body }}
    </p>

    <ul v-if="message.reports.length" class="flex flex-col gap-2">
      <li
        v-for="report in message.reports"
        :key="report.id"
        class="flex flex-wrap items-center gap-2 rounded-md border border-hairline p-2 text-caption"
      >
        <Flag :size="ICON_SIZE" aria-hidden="true" />
        <span class="font-semibold">{{ t(`admin.messaging.reasons.${report.reason}`) }}</span>
        <span class="text-text-secondary">{{ report.reporterEmail ?? '—' }}</span>
        <span v-if="report.details" class="text-text-secondary">« {{ report.details }} »</span>
        <BaseBadge :tone="report.status === 'open' ? 'warning' : 'neutral'">
          {{
            report.resolution
              ? t(`admin.messaging.resolutions.${report.resolution}`)
              : t('admin.messaging.status.open')
          }}
        </BaseBadge>
        <BaseButton
          v-if="report.status === 'open'"
          size="sm"
          variant="secondary"
          :disabled="processing"
          @click="post('admin.messaging.dismiss', report.id)"
        >
          {{ t('admin.messaging.actions.dismiss') }}
        </BaseButton>
      </li>
    </ul>

    <div class="flex flex-wrap gap-2">
      <BaseButton
        v-if="!message.hiddenAt"
        size="sm"
        variant="secondary"
        :disabled="processing"
        @click="post('admin.messaging.hide', message.id, 'admin.messaging.confirm.hide')"
      >
        <template #icon><EyeOff :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.messaging.actions.hide') }}
      </BaseButton>
      <BaseButton
        v-else
        size="sm"
        variant="secondary"
        :disabled="processing"
        @click="post('admin.messaging.unhide', message.id)"
      >
        <template #icon><Eye :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.messaging.actions.unhide') }}
      </BaseButton>
      <BaseButton
        v-if="message.authorEmail && (hasOpenReport() || !message.reports.length)"
        size="sm"
        variant="secondary"
        :disabled="processing"
        @click="post('admin.messaging.warn', message.id, 'admin.messaging.confirm.warn')"
      >
        <template #icon><TriangleAlert :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.messaging.actions.warn') }}
      </BaseButton>
    </div>
  </li>
</template>
