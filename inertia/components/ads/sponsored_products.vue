<script setup lang="ts">
import ProductCard from '~/components/product_card.vue'
import type { SponsoredProductType } from '#shared/types/ads'

/**
 * Grille de produits sponsorisés. Chaque vignette porte le badge « Sponsorisé »
 * et pointe vers le lien de clic signé fourni par le serveur — un lien classique
 * (pas une visite Inertia, jamais préchargé) : le clic est compté une fois, puis
 * redirigé vers la fiche. `rel="sponsored"` le signale aux moteurs de recherche.
 */
withDefaults(defineProps<{ items: SponsoredProductType[]; columns?: 3 | 4 }>(), { columns: 3 })
</script>

<template>
  <ul
    class="grid gap-4 sm:grid-cols-2"
    :class="columns === 4 ? 'lg:grid-cols-4' : 'xl:grid-cols-3'"
    data-testid="sponsored-products"
  >
    <li v-for="item in items" :key="item.product.id">
      <a :href="item.clickUrl" rel="sponsored nofollow" class="block h-full rounded-xl">
        <ProductCard :product="item.product" sponsored />
      </a>
    </li>
  </ul>
</template>
