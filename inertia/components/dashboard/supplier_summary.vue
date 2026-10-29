<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { Boxes, Gauge, Inbox, ListChecks, Store } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseStat from '~/components/base/base_stat.vue'
import type { BadgeTone } from '~/types/ui'
import type { SupplierDashboardType } from '#shared/types/dashboard'

const props = defineProps<{ supplier: SupplierDashboardType }>()

const { t, locale } = useI18n()

interface TodoItem {
  key: string
  icon: Component
  label: string
  href: string
  badge: string
  tone: BadgeTone
}

/** Actions en attente : demandes reçues non ouvertes, profil incomplet. */
const todos = computed<TodoItem[]>(() => {
  const items: TodoItem[] = []
  if (props.supplier.unreadRfqs > 0) {
    items.push({
      key: 'unread',
      icon: Inbox,
      label: t('dashboard.supplier.todo.unread', { count: props.supplier.unreadRfqs }),
      href: urlFor('supplier.rfqs.index', { locale: locale.value }),
      badge: String(props.supplier.unreadRfqs),
      tone: 'warning',
    })
  }
  if (props.supplier.profileCompleteness < 100) {
    items.push({
      key: 'profile',
      icon: Store,
      label: t('dashboard.supplier.completeProfile'),
      href: urlFor('supplier.profile', { locale: locale.value }),
      badge: `${props.supplier.profileCompleteness} %`,
      tone: 'info',
    })
  }
  return items
})
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="supplier-summary">
    <h2 class="text-heading-lg text-text-primary">{{ t('dashboard.supplier.title') }}</h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BaseStat
        :label="t('dashboard.supplier.unread')"
        :value="supplier.unreadRfqs"
        :icon="Inbox"
        :href="urlFor('supplier.rfqs.index', { locale })"
      />
      <BaseStat
        :label="t('dashboard.supplier.products')"
        :value="supplier.activeProducts"
        :icon="Boxes"
        :href="urlFor('supplier.products.index', { locale })"
      />
      <BaseStat
        :label="t('dashboard.supplier.completeness')"
        :value="`${supplier.profileCompleteness} %`"
        :icon="Gauge"
        :href="urlFor('supplier.profile', { locale })"
      />
    </div>

    <BaseSection :title="t('dashboard.supplier.todo.title')">
      <template #actions>
        <Link
          :href="urlFor('supplier.rfqs.index', { locale })"
          class="text-body-sm font-semibold text-indigo-600 hover:underline"
        >
          {{ t('dashboard.supplier.viewRfqs') }}
        </Link>
      </template>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-caption font-semibold text-text-muted">
            {{ t('dashboard.supplier.completeness') }}
          </span>
          <span class="text-tabular text-body-sm font-semibold text-text-primary">
            {{ supplier.profileCompleteness }} %
          </span>
        </div>
        <div
          class="h-2 w-full overflow-hidden rounded-pill bg-ink-100"
          role="progressbar"
          :aria-label="t('dashboard.supplier.completeness')"
          :aria-valuenow="supplier.profileCompleteness"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-pill bg-indigo-500 transition-[width] duration-200 ease-out"
            :style="{ width: `${supplier.profileCompleteness}%` }"
          />
        </div>
      </div>

      <BaseEmptyState
        v-if="todos.length === 0"
        compact
        class="mt-6"
        :icon="ListChecks"
        :title="t('dashboard.supplier.todo.empty')"
      />
      <ul v-else class="mt-4 -mb-3 flex flex-col">
        <li
          v-for="todo in todos"
          :key="todo.key"
          class="flex items-center gap-3 border-b border-hairline py-3 last:border-0"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-subtle text-indigo-600"
            aria-hidden="true"
          >
            <component :is="todo.icon" :size="18" />
          </span>
          <Link
            :href="todo.href"
            class="min-w-0 flex-1 truncate text-body-sm font-semibold text-text-primary hover:text-indigo-600 hover:underline"
          >
            {{ todo.label }}
          </Link>
          <BaseBadge :tone="todo.tone" dot>{{ todo.badge }}</BaseBadge>
        </li>
      </ul>
    </BaseSection>
  </section>
</template>
