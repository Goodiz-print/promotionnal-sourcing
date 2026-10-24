<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseStat from '~/components/base/base_stat.vue'
import { Link } from '@adonisjs/inertia/vue'
import type { SupplierDashboardType } from '#shared/types/dashboard'

defineProps<{ supplier: SupplierDashboardType }>()

const { t, locale } = useI18n()
</script>

<template>
  <section class="mb-10" data-testid="supplier-summary">
    <div class="mb-4 flex items-center justify-between gap-4">
      <h2 class="text-xl font-medium">{{ t('dashboard.supplier.title') }}</h2>
      <Link
        route="supplier.rfqs.index"
        :params="{ locale }"
        class="text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        {{ t('dashboard.supplier.viewRfqs') }}
      </Link>
    </div>

    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <BaseStat :label="t('dashboard.supplier.unread')" :value="supplier.unreadRfqs" />
      <BaseStat :label="t('dashboard.supplier.products')" :value="supplier.activeProducts" />
      <BaseStat
        :label="t('dashboard.supplier.completeness')"
        :value="`${supplier.profileCompleteness} %`"
      />
    </dl>

    <p v-if="supplier.profileCompleteness < 100" class="mt-4">
      <Link
        route="supplier.profile"
        :params="{ locale }"
        class="text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        {{ t('dashboard.supplier.completeProfile') }}
      </Link>
    </p>
  </section>
</template>
