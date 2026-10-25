<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import NotificationItem from '~/components/notifications/notification_item.vue'
import type { NotificationItemType } from '#shared/types/notification'

defineProps<{ notifications: NotificationItemType[] }>()

const { t, locale } = useI18n()

function markAllRead() {
  router.post(
    urlFor('notifications.readAll', { locale: locale.value }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <Head :title="t('notifications.title')" />

  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-7.5 py-10">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-[32px] tracking-[-0.5px]">{{ t('notifications.title') }}</h1>
      <BaseButton
        v-if="notifications.some((notification) => notification.readAt === null)"
        variant="secondary"
        @click="markAllRead"
      >
        {{ t('notifications.markAllRead') }}
      </BaseButton>
    </div>

    <p v-if="notifications.length === 0" class="text-[var(--gray-6)]">
      {{ t('notifications.empty') }}
    </p>
    <ul v-else class="flex flex-col gap-1 rounded border border-[var(--gray-3)] p-2">
      <li v-for="notification in notifications" :key="notification.id">
        <NotificationItem :notification="notification" />
      </li>
    </ul>
  </div>
</template>
