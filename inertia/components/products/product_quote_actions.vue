<script setup lang="ts">
import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { Check, FileText, LogIn, ShoppingCart } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import type { ProductRfqContextType } from '#shared/types/rfq'

/**
 * Demande de devis depuis une fiche produit.
 *
 * - acheteur connecté (`canCreateRfq`) : ajoute le produit à son panier de
 *   devis, à la quantité choisie (le minimum de commande par défaut) ; une fois
 *   au panier, renvoie vers lui. Un lien « Demande détaillée » ouvre le
 *   formulaire complet, pré-rempli avec ce produit ;
 * - visiteur anonyme : renvoyé vers la connexion, qui le ramène ici ;
 * - connecté sans droit d'acheteur : rien (le bouton serait une impasse).
 */
const props = defineProps<{
  productId: number
  productSlug: string
  minQuantity: number | null
  /** Variante affichée sur la fiche : c'est elle qui part au panier. */
  variantId?: number | null
  rfqContext: ProductRfqContextType
}>()

const { t, locale } = useI18n()
const page = usePage()

const quantity = ref<number | null>(props.minQuantity ?? 1)
// Évite le double clic pendant l'ajout.
const adding = ref(false)

// « Dans votre panier » vaut pour la variante affichée : une autre couleur reste ajoutable.
const inCart = computed(() => props.rfqContext.inCartVariantIds.includes(props.variantId ?? null))

const cartUrl = computed(() => urlFor('quote_cart.show', { locale: locale.value }))
const detailedUrl = computed(
  () => `${urlFor('rfqs.create', { locale: locale.value })}?productId=${props.productId}`
)

function addToCart() {
  if (adding.value) return
  adding.value = true
  router.post(
    urlFor('quote_cart.items.store', { locale: locale.value }),
    { productId: props.productId, quantity: quantity.value, variantId: props.variantId ?? null },
    { preserveScroll: true, onFinish: () => (adding.value = false) }
  )
}

function signIn() {
  router.get(urlFor('session.create', { locale: locale.value }), {
    redirect: urlFor('products.show', { locale: locale.value, slug: props.productSlug }),
  })
}
</script>

<template>
  <div v-if="rfqContext.canCreateRfq" class="flex flex-col gap-3">
    <div v-if="inCart" class="flex flex-wrap items-center gap-3">
      <p class="flex items-center gap-2 text-body-sm font-semibold text-success">
        <Check :size="18" aria-hidden="true" />
        {{ t('quote_cart.product.inCart') }}
      </p>
      <BaseLinkButton :href="cartUrl" variant="secondary">
        <ShoppingCart :size="18" aria-hidden="true" />
        {{ t('quote_cart.product.viewCart') }}
      </BaseLinkButton>
    </div>

    <form v-else class="flex flex-wrap items-end gap-3" @submit.prevent="addToCart()">
      <div class="w-32">
        <BaseInput
          id="quote-cart-quantity"
          v-model="quantity"
          type="number"
          :min="1"
          :step="1"
          :label="t('quote_cart.product.quantity')"
        />
      </div>
      <BaseButton type="submit" :loading="adding" :disabled="!quantity || quantity < 1">
        <template #icon><ShoppingCart :size="18" aria-hidden="true" /></template>
        {{ t('quote_cart.product.add') }}
      </BaseButton>
    </form>

    <div>
      <BaseLinkButton :href="detailedUrl" variant="ghost" size="sm">
        <FileText :size="16" aria-hidden="true" />
        {{ t('quote_cart.product.detailedRequest') }}
      </BaseLinkButton>
    </div>
  </div>

  <div v-else-if="!page.props.user">
    <BaseButton @click="signIn()">
      <template #icon><LogIn :size="18" aria-hidden="true" /></template>
      {{ t('products.show.signInToRequest') }}
    </BaseButton>
  </div>
</template>
