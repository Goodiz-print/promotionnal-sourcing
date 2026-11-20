<script setup lang="ts">
import { computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n, type TranslateData } from '~/i18n'
import { notificationMessageKey } from '#shared/helpers/notification'
import type { NotificationItemType } from '#shared/types/notification'

/**
 * Une notification : son texte (un libellé par type, `notifications.types.*`,
 * ou `notifications.anonymous.*` sans nom d'agence — cf. `notificationMessageKey`),
 * sa date, et un point si elle n'est pas lue. Cliquer la marque lue puis ouvre
 * l'écran qu'elle concerne : c'est le serveur qui redirige (`notifications.read`).
 */
const props = defineProps<{ notification: NotificationItemType }>()

const { t, locale } = useI18n()

const unread = computed(() => props.notification.readAt === null)

const text = computed(() => {
  const data: TranslateData = {}
  for (const [key, value] of Object.entries(props.notification.data)) data[key] = value ?? ''
  return t(notificationMessageKey(props.notification.type, props.notification.data), data)
})

const date = computed(() =>
  new Date(props.notification.createdAt).toLocaleString(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
)

function open() {
  router.patch(urlFor('notifications.read', { locale: locale.value, id: props.notification.id }))
}
</script>

<template>
  <button
    type="button"
    class="flex w-full cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-500"
    @click="open"
  >
    <span
      class="mt-1.5 size-2 shrink-0 rounded-full"
      :class="unread ? 'bg-indigo-500' : 'bg-transparent'"
      :aria-label="unread ? t('notifications.unread') : undefined"
    />
    <span class="flex flex-col gap-0.5">
      <span
        class="text-body-sm"
        :class="unread ? 'font-semibold text-text-primary' : 'text-text-secondary'"
      >
        {{ text }}
      </span>
      <time :datetime="notification.createdAt" class="text-caption text-text-muted">
        {{ date }}
      </time>
    </span>
  </button>
</template>
