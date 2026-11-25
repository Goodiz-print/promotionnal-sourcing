<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import type { RfqItemType } from '#shared/types/rfq'

/**
 * Lignes du besoin en lecture seule. Partagé par l'écran acheteur (demande
 * publiée, plus éditable) et l'écran fournisseur (jamais éditable) : les deux
 * affichent exactement le même besoin, seule la barre d'actions diffère.
 * Conçu pour le corps d'une `BaseSection` : lignes séparées par une hairline,
 * sans marge externe.
 */
defineProps<{ items: RfqItemType[] }>()

const { t, locale } = useI18n()

/**
 * Libellé d'une précision (`specs`) : les clés posées par le panier de devis
 * sont traduites (`rfq.specs.<clé>`), une clé inconnue s'affiche telle quelle.
 */
function specLabel(key: string): string {
  const translationKey = `rfq.specs.${key}`
  const label = t(translationKey)
  // `t` renvoie la clé quand la traduction manque.
  return label === translationKey ? key : label
}
</script>

<template>
  <ul class="flex flex-col">
    <li
      v-for="item in items"
      :key="item.id"
      class="flex flex-col gap-1 border-b border-hairline py-3 first:pt-0 last:border-0 last:pb-0"
    >
      <div class="flex items-baseline justify-between gap-4">
        <p class="text-body-md font-semibold text-text-primary">{{ item.name }}</p>
        <span class="text-tabular text-body-sm whitespace-nowrap text-text-secondary">
          {{ item.quantity }} {{ item.unit }}
        </span>
      </div>
      <p v-if="item.description" class="text-body-sm text-text-secondary">
        {{ item.description }}
      </p>
      <dl
        v-if="item.specs && Object.keys(item.specs).length > 0"
        class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-body-sm"
        data-testid="rfq-item-specs"
      >
        <template v-for="(value, key) in item.specs" :key="key">
          <dt class="text-text-muted">{{ specLabel(String(key)) }}</dt>
          <dd class="text-tabular text-text-primary">{{ value }}</dd>
        </template>
      </dl>
      <p
        v-if="item.categoryName || item.productName"
        class="flex flex-wrap gap-x-3 text-caption text-text-muted"
      >
        <span v-if="item.categoryName">{{ t('rfq.show.category') }} : {{ item.categoryName }}</span>
        <span v-if="item.productName">{{ t('rfq.show.product') }} : {{ item.productName }}</span>
      </p>
      <Link
        v-if="item.productSlug"
        route="products.show"
        :params="{ locale, slug: item.productSlug }"
        class="w-fit text-body-sm font-semibold text-indigo-600 hover:underline"
      >
        {{ t('rfq.show.viewProduct') }}
      </Link>
    </li>
  </ul>
</template>
