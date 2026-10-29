<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { ProductMarkingPositionType, ProductMarkingPriceTierType } from '#shared/types/marking'

/**
 * Marquage structuré (écart 2) : positions (surface maximale, techniques) et
 * grille de prix de marquage. Donnée de fiche, jamais un filtre. Affiché dès
 * qu'une position ou un palier est renseigné.
 */
const props = defineProps<{
  positions: ProductMarkingPositionType[]
  priceTiers: ProductMarkingPriceTierType[]
}>()

const { t } = useI18n()

const visible = computed(() => props.positions.length > 0 || props.priceTiers.length > 0)

function techniques(position: ProductMarkingPositionType): string {
  return position.techniques
    .map((technique) => technique.techniqueName ?? technique.techniqueSlug)
    .join(', ')
}
</script>

<template>
  <BaseSection v-if="visible" :title="t('products.show.marking')">
    <div class="flex flex-col gap-5">
      <ul v-if="positions.length > 0" class="flex flex-col divide-y divide-hairline">
        <li
          v-for="position in positions"
          :key="position.id"
          class="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0"
        >
          <div class="flex items-baseline justify-between gap-4">
            <span class="text-body-sm font-semibold text-text-primary">{{ position.name }}</span>
            <span
              v-if="position.maxWidthMm || position.maxHeightMm"
              class="text-tabular text-caption text-text-muted"
            >
              {{ position.maxWidthMm ?? '—' }} × {{ position.maxHeightMm ?? '—' }} mm
            </span>
          </div>
          <p v-if="position.techniques.length > 0" class="text-body-sm text-text-secondary">
            {{ techniques(position) }}
          </p>
        </li>
      </ul>

      <div v-if="priceTiers.length > 0" class="flex flex-col gap-2">
        <h3 class="text-heading-sm text-text-primary">{{ t('products.show.markingPrices') }}</h3>
        <BaseTable :caption="t('products.show.markingPrices')">
          <template #head>
            <tr>
              <th scope="col">{{ t('products.show.markingTechnique') }}</th>
              <th scope="col">{{ t('products.show.tierQuantity') }}</th>
              <th scope="col" class="text-right">{{ t('products.show.tierPrice') }}</th>
            </tr>
          </template>
          <tr v-for="tier in priceTiers" :key="tier.id">
            <td>{{ tier.techniqueName ?? tier.techniqueSlug }}</td>
            <td class="text-tabular">
              {{ t('products.show.tierFrom', { quantity: tier.minQuantity }) }}
            </td>
            <td class="text-tabular text-right font-semibold text-indigo-600">
              {{ Number(tier.unitPrice) }} {{ tier.currency }}
            </td>
          </tr>
        </BaseTable>
      </div>
    </div>
  </BaseSection>
</template>
