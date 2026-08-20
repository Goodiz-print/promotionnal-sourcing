<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'

defineProps<{ current: 'settings' | 'members' }>()

const { t, locale } = useI18n()
</script>

<template>
  <nav class="mb-8 flex gap-4 border-b border-[var(--gray-3)]">
    <Link
      route="organization.settings"
      :params="{ locale }"
      class="border-b-2 px-1 pb-3 text-sm font-medium"
      :class="
        current === 'settings'
          ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
          : 'border-transparent text-[var(--gray-6)]'
      "
    >
      {{ t('organization.nav.settings') }}
    </Link>
    <Link
      route="organization.members"
      :params="{ locale }"
      class="border-b-2 px-1 pb-3 text-sm font-medium"
      :class="
        current === 'members'
          ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
          : 'border-transparent text-[var(--gray-6)]'
      "
    >
      {{ t('organization.nav.members') }}
    </Link>
    <!-- Point d'entrée de la création : le sélecteur d'organisation étant masqué
         tant qu'on n'en a qu'une, il ne peut pas porter cette action. -->
    <Link
      route="organization.create"
      :params="{ locale }"
      class="ml-auto border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-[var(--color-primary)] hover:underline"
    >
      {{ t('organization.nav.create') }}
    </Link>
  </nav>
</template>
