<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Image as ImageIcon, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import type { QuoteCartItemType } from '#shared/types/quote_cart'

/**
 * Une ligne du panier : produit, quantité et précisions. Les modifications
 * sont enregistrées d'elles-mêmes (après une courte pause de saisie), comme
 * dans un panier marchand — pas de bouton « enregistrer ».
 */
const props = defineProps<{ item: QuoteCartItemType }>()

const { t, locale } = useI18n()

/** Pause de saisie avant l'enregistrement. */
const SAVE_DELAY_MS = 600

const quantity = ref<number | null>(props.item.quantity)
const note = ref(props.item.note ?? '')
let timer: ReturnType<typeof setTimeout> | undefined

const belowMinimum = computed(
  () =>
    props.item.minQuantity !== null &&
    quantity.value !== null &&
    quantity.value < props.item.minQuantity
)

function schedule(changes: { quantity?: number; note?: string | null }) {
  clearTimeout(timer)
  timer = setTimeout(() => save(changes), SAVE_DELAY_MS)
}

function save(changes: { quantity?: number; note?: string | null }) {
  router.patch(
    urlFor('quote_cart.items.update', { locale: locale.value, id: props.item.id }),
    changes,
    {
      preserveScroll: true,
      preserveState: true,
      only: ['groups'],
    }
  )
}

function onQuantity(value: number | null) {
  quantity.value = value
  // Une saisie vide ou nulle n'est pas une quantité : on attend la suivante.
  if (value !== null && Number.isInteger(value) && value > 0) schedule({ quantity: value })
}

function onNote(value: string) {
  note.value = value
  schedule({ note: value.trim() || null })
}

function remove() {
  clearTimeout(timer)
  router.delete(urlFor('quote_cart.items.destroy', { locale: locale.value, id: props.item.id }), {
    preserveScroll: true,
  })
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <li class="flex flex-col gap-4 py-4 sm:flex-row sm:items-start" data-testid="quote-cart-line">
    <img
      v-if="item.imageUrl"
      :src="item.imageUrl"
      :alt="item.productName"
      class="size-16 shrink-0 rounded-md bg-sunken object-cover"
    />
    <div
      v-else
      class="flex size-16 shrink-0 items-center justify-center rounded-md bg-sunken text-text-muted"
      aria-hidden="true"
    >
      <ImageIcon :size="24" :stroke-width="1.5" />
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <Link
          route="products.show"
          :params="{ locale, slug: item.productSlug }"
          class="text-body-sm font-semibold text-text-primary hover:text-indigo-600"
        >
          {{ item.productName }}
        </Link>
        <BaseIconButton
          :label="t('quote_cart.line.remove', { name: item.productName })"
          @click="remove()"
        >
          <Trash2 :size="18" aria-hidden="true" />
        </BaseIconButton>
      </div>

      <div class="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <BaseInput
          :id="`quote-cart-quantity-${item.id}`"
          :model-value="quantity"
          type="number"
          :min="1"
          :step="1"
          :label="t('quote_cart.line.quantity')"
          :hint="
            belowMinimum ? t('quote_cart.line.belowMinimum', { count: item.minQuantity! }) : ''
          "
          @update:model-value="onQuantity"
        />
        <BaseInput
          :id="`quote-cart-note-${item.id}`"
          :model-value="note"
          :label="t('quote_cart.line.note')"
          @update:model-value="onNote"
        />
      </div>
    </div>
  </li>
</template>
