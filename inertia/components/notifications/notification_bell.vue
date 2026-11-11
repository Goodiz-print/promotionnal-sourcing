<script setup lang="ts">
import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { toast } from 'vue-sonner'
import { Link } from '@adonisjs/inertia/vue'
import { Bell } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useNotificationStream } from '~/composables/use_notification_stream'
import BaseCountBadge from '~/components/base/base_count_badge.vue'
import BaseDropdown from '~/components/base/base_dropdown.vue'
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

function onOpen() {
  open.value = true
  refresh()
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
  <BaseDropdown width="w-80 max-w-[90vw]" @open="onOpen" @close="open = false">
    <template #trigger="{ open: isOpen, toggle }">
      <button
        type="button"
        :title="t('notifications.title')"
        :aria-label="t('notifications.title')"
        :aria-expanded="isOpen"
        aria-haspopup="true"
        class="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-ink-100 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        :class="isOpen ? 'bg-brand-subtle text-indigo-600' : ''"
        @click="toggle"
      >
        <Bell :size="20" aria-hidden="true" />
        <BaseCountBadge
          data-testid="unread-badge"
          :count="count"
          :label="t('notifications.unreadCount', { count })"
        />
      </button>
    </template>
    <div class="flex items-center justify-between border-b border-hairline px-3 py-2.5">
      <p class="text-heading-sm">{{ t('notifications.title') }}</p>
      <button
        v-if="count > 0"
        type="button"
        class="cursor-pointer text-caption font-semibold text-indigo-600 hover:underline"
        @click="markAllRead"
      >
        {{ t('notifications.markAllRead') }}
      </button>
    </div>
    <div class="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto py-1">
      <p v-if="recent.length === 0" class="px-3 py-6 text-center text-body-sm text-text-muted">
        {{ t('notifications.empty') }}
      </p>
      <NotificationItem
        v-for="notification in recent"
        :key="notification.id"
        :notification="notification"
      />
    </div>
    <div class="border-t border-hairline px-3 py-2">
      <Link
        route="notifications.index"
        :params="{ locale }"
        class="text-body-sm font-semibold text-indigo-600 hover:underline"
      >
        {{ t('notifications.seeAll') }}
      </Link>
    </div>
  </BaseDropdown>
</template>
