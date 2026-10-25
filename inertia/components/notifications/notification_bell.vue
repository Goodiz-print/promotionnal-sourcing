<script setup lang="ts">
import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { toast } from 'vue-sonner'
import { Link } from '@adonisjs/inertia/vue'
import type { Data } from '@generated/data'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useNotificationStream } from '~/composables/use_notification_stream'
import NotificationItem from '~/components/notifications/notification_item.vue'

/**
 * Cloche du bandeau (#57) : pastille des non lues (prop partagée
 * `unreadNotificationsCount`), menu des dernières notifications chargées à
 * l'ouverture (partial reload de `recentNotifications`), et mise à jour en temps
 * réel quand une notification arrive.
 */
const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const open = ref(false)
const count = computed(() => page.props.unreadNotificationsCount ?? 0)
const recent = computed(() => page.props.recentNotifications ?? [])

function refresh() {
  router.reload({
    only: open.value
      ? ['unreadNotificationsCount', 'recentNotifications']
      : ['unreadNotificationsCount'],
  })
}

function onToggle(event: Event) {
  open.value = (event.target as HTMLDetailsElement).open
  if (open.value) refresh()
}

function markAllRead() {
  router.post(
    urlFor('notifications.readAll', { locale: locale.value }),
    {},
    { preserveScroll: true, only: ['unreadNotificationsCount', 'recentNotifications'] }
  )
}

useNotificationStream(() => {
  toast.info(t('notifications.toast'))
  refresh()
})
</script>

<template>
  <details class="relative" @toggle="onToggle">
    <summary
      :title="t('notifications.title')"
      :aria-label="t('notifications.title')"
      class="relative flex size-9 cursor-pointer list-none items-center justify-center rounded-full hover:bg-[var(--gray-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
    >
      <span aria-hidden="true">🔔</span>
      <span
        v-if="count > 0"
        class="absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-[var(--state-danger)] px-1 text-[11px] leading-4.5 font-medium text-white"
        :aria-label="t('notifications.unreadCount', { count })"
      >
        {{ count > 99 ? '99+' : count }}
      </span>
    </summary>
    <div
      class="absolute right-0 z-20 mt-2 flex w-80 max-w-[90vw] flex-col gap-1 rounded border border-[var(--gray-4)] bg-white p-2 shadow-lg"
    >
      <p v-if="recent.length === 0" class="px-3 py-2 text-sm text-[var(--gray-6)]">
        {{ t('notifications.empty') }}
      </p>
      <NotificationItem
        v-for="notification in recent"
        :key="notification.id"
        :notification="notification"
      />
      <div class="flex items-center justify-between border-t border-[var(--gray-3)] px-3 pt-2">
        <Link
          route="notifications.index"
          :params="{ locale }"
          class="text-sm font-medium text-[var(--primary-11)]"
        >
          {{ t('notifications.seeAll') }}
        </Link>
        <button
          v-if="count > 0"
          type="button"
          class="cursor-pointer text-sm text-[var(--gray-8)] hover:text-[var(--gray-12)]"
          @click="markAllRead"
        >
          {{ t('notifications.markAllRead') }}
        </button>
      </div>
    </div>
  </details>
</template>
