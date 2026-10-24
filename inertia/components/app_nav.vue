<script setup lang="ts">
import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import type { Data } from '@generated/data'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { isActivePath } from '#shared/helpers/navigation'

/**
 * Menu applicatif alimenté par la prop partagée `navigation` (calculée côté
 * serveur selon le type d'organisation et le rôle). `vertical` sert au panneau
 * mobile du layout.
 */
withDefaults(defineProps<{ orientation?: 'horizontal' | 'vertical' }>(), {
  orientation: 'horizontal',
})

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const items = computed(() =>
  (page.props.navigation ?? []).map((item) => {
    const href = urlFor(item.route, { locale: locale.value })
    return { ...item, active: isActivePath(page.url, href) }
  })
)
</script>

<template>
  <nav
    :aria-label="t('common.nav.main')"
    class="flex gap-1"
    :class="orientation === 'vertical' ? 'flex-col' : 'flex-row items-center'"
  >
    <Link
      v-for="item in items"
      :key="item.key"
      :route="item.route"
      :params="{ locale }"
      :aria-current="item.active ? 'page' : undefined"
      class="rounded px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
      :class="
        item.active
          ? 'bg-[var(--primary-3)] text-[var(--primary-11)]'
          : 'text-[var(--gray-8)] hover:bg-[var(--gray-2)] hover:text-[var(--gray-12)]'
      "
    >
      {{ t(item.labelKey) }}
    </Link>
  </nav>
</template>
