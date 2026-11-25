<script setup lang="ts">
import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { ShoppingCart } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseCountBadge from '~/components/base/base_count_badge.vue'

/**
 * Accès au panier de devis depuis le bandeau, avec le nombre de produits (prop
 * partagée `quoteCartCount`). Absent pour qui ne peut pas demander de devis :
 * la prop vaut alors `undefined`.
 */
const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const count = computed(() => page.props.quoteCartCount)
const href = computed(() => urlFor('quote_cart.show', { locale: locale.value }))
</script>

<template>
  <Link
    v-if="count !== undefined"
    :href="href"
    :title="t('quote_cart.nav.label')"
    :aria-label="t('quote_cart.nav.count', { count })"
    class="relative inline-flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-ink-100 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
  >
    <ShoppingCart :size="20" aria-hidden="true" />
    <BaseCountBadge
      data-testid="quote-cart-badge"
      tone="brand"
      :count="count"
      :label="t('quote_cart.nav.count', { count })"
    />
  </Link>
</template>
