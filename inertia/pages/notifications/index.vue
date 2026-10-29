<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { BellOff, CheckCheck } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import NotificationItem from '~/components/notifications/notification_item.vue'
import type { NotificationItemType } from '#shared/types/notification'

const props = defineProps<{ notifications: NotificationItemType[] }>()

const { t, locale } = useI18n()

const hasUnread = computed(() =>
  props.notifications.some((notification) => notification.readAt === null)
)

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

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('notifications.title')">
      <template v-if="hasUnread" #actions>
        <BaseButton variant="secondary" @click="markAllRead">
          <template #icon><CheckCheck :size="18" aria-hidden="true" /></template>
          {{ t('notifications.markAllRead') }}
        </BaseButton>
      </template>
    </BasePageHeader>

    <BaseEmptyState
      v-if="notifications.length === 0"
      :title="t('notifications.empty')"
      :icon="BellOff"
    />
    <BaseSection v-else flush>
      <ul class="divide-y divide-hairline">
        <li v-for="notification in notifications" :key="notification.id" class="px-2 py-1">
          <NotificationItem :notification="notification" />
        </li>
      </ul>
    </BaseSection>
  </div>
</template>
