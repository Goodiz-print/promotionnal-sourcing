<script setup lang="ts">
import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { Check, ShoppingCart } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'

/**
 * Ajout rapide au panier de devis depuis une carte du catalogue, à la quantité
 * minimale du produit. Posé **à côté** du lien de la carte (un bouton dans un
 * lien n'est pas valide) : le parent le place en surimpression. Masqué pour
 * qui ne peut pas demander de devis (`quoteCartCount` absent).
 *
 * Seule la pastille du bandeau est rechargée : inutile de relancer la
 * recherche du catalogue pour un ajout.
 */
const props = defineProps<{ productId: number; productName: string }>()

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const visible = computed(() => page.props.quoteCartCount !== undefined)
const adding = ref(false)
const added = ref(false)

function add() {
  if (adding.value) return
  adding.value = true
  router.post(
    urlFor('quote_cart.items.store', { locale: locale.value }),
    { productId: props.productId },
    {
      preserveScroll: true,
      preserveState: true,
      only: ['quoteCartCount'],
      onSuccess: () => {
        added.value = true
      },
      onFinish: () => {
        adding.value = false
      },
    }
  )
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    data-testid="quote-cart-add"
    :aria-label="t('quote_cart.card.add', { name: productName })"
    :title="t('quote_cart.card.add', { name: productName })"
    :disabled="adding"
    class="inline-flex size-9 cursor-pointer items-center justify-center rounded-pill border border-hairline bg-card text-text-secondary shadow-1 transition-colors hover:bg-brand-subtle hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:pointer-events-none disabled:opacity-50"
    :class="added ? 'text-indigo-600' : ''"
    @click="add()"
  >
    <Check v-if="added" :size="18" aria-hidden="true" />
    <ShoppingCart v-else :size="18" aria-hidden="true" />
  </button>
</template>
