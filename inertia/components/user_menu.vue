<script setup lang="ts">
import { usePage } from '@inertiajs/vue3'
import { Link, Form } from '@adonisjs/inertia/vue'
import { ChevronDown, LogOut, UserRound } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import BaseAvatar from '~/components/base/base_avatar.vue'
import BaseDropdown from '~/components/base/base_dropdown.vue'
import { ICON_SIZE } from '~/types/ui'

defineProps<{ initials: string }>()

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-body-sm font-medium text-text-primary transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-500'
</script>

<template>
  <BaseDropdown width="w-64">
    <template #trigger="{ open, toggle }">
      <button
        type="button"
        :title="t('common.nav.userMenu')"
        :aria-label="t('common.nav.userMenu')"
        aria-haspopup="menu"
        :aria-expanded="open"
        class="flex cursor-pointer items-center gap-1.5 rounded-pill p-0.5 pr-1.5 transition-colors hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        @click="toggle"
      >
        <BaseAvatar :initials="initials" size="sm" />
        <ChevronDown :size="14" class="text-text-muted" aria-hidden="true" />
      </button>
    </template>
    <div v-if="page.props.user" class="flex flex-col gap-0.5 border-b border-hairline px-3 py-2.5">
      <p class="truncate text-body-sm font-semibold text-text-primary">
        {{ page.props.user.fullName }}
      </p>
      <p class="truncate text-caption text-text-muted">{{ page.props.user.email }}</p>
    </div>
    <div class="flex flex-col gap-0.5 pt-1">
      <Link route="account.show" :params="{ locale }" :class="ITEM_CLASS">
        <UserRound :size="ICON_SIZE" class="text-text-muted" aria-hidden="true" />
        {{ t('common.nav.account') }}
      </Link>
      <Form route="session.destroy" :params="{ locale }">
        <button type="submit" :class="ITEM_CLASS">
          <LogOut :size="ICON_SIZE" class="text-text-muted" aria-hidden="true" />
          {{ t('common.nav.logout') }}
        </button>
      </Form>
    </div>
  </BaseDropdown>
</template>
