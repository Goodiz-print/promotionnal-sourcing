<script setup lang="ts">
import BaseStat from '~/components/base/base_stat.vue'
import { useKpiFormat } from '~/composables/use_kpi_format'
import type { KpiItem } from '~/components/admin/types'

/**
 * Groupe de compteurs du tableau de bord KPI : titre de groupe, puis une carte par
 * indicateur avec sa valeur sur la période et sur la période précédente.
 */
defineProps<{ title: string; items: KpiItem[] }>()

const { value, previous } = useKpiFormat()
</script>

<template>
  <section class="flex flex-col gap-3" :aria-label="title">
    <h2 class="text-heading-md">{{ title }}</h2>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BaseStat
        v-for="item in items"
        :key="item.key"
        :data-testid="`kpi-${item.key}`"
        :label="item.label"
        :value="value(item.metric.current, item.format)"
        :hint="previous(item.metric, item.format)"
        :icon="item.icon"
      />
      <slot />
    </div>
  </section>
</template>
