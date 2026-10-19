<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'

type AdminSection = 'dashboard' | 'organizations' | 'users' | 'categories'

defineProps<{ current: AdminSection }>()

const { t, locale } = useI18n()

const SECTIONS = [
  { key: 'dashboard', route: 'admin.dashboard' },
  { key: 'organizations', route: 'admin.organizations.index' },
  { key: 'users', route: 'admin.users.index' },
  { key: 'categories', route: 'admin.categories.index' },
] as const
</script>

<template>
  <nav class="mb-8 flex gap-4 border-b border-[var(--gray-3)]">
    <Link
      v-for="section in SECTIONS"
      :key="section.key"
      :route="section.route"
      :params="{ locale }"
      class="border-b-2 px-1 pb-3 text-sm font-medium"
      :class="
        current === section.key
          ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
          : 'border-transparent text-[var(--gray-6)]'
      "
    >
      {{ t(`admin.nav.${section.key}`) }}
    </Link>
  </nav>
</template>
