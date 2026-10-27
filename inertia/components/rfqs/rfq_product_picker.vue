<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import type { RfqProductOptionType } from '#shared/types/rfq'

/**
 * Recherche dans le catalogue pour remplir une ligne de demande. La recherche
 * passe par un **partial reload** de la page courante
 * (`only: ['productResults', 'productSearchUnavailable']`) : le serveur ne calcule la prop que sur
 * demande, et l'état du formulaire n'est pas touché (`preserveState`).
 *
 * Le moteur derrière est Elasticsearch (#112, ADR 0002) : `unavailable` signale qu'il est
 * injoignable — cf. `docs/rfq.md`.
 */
defineProps<{ results?: RfqProductOptionType[]; unavailable?: boolean }>()

const emit = defineEmits<{ pick: [product: RfqProductOptionType] }>()

const { t } = useI18n()

const MIN_LENGTH = 2
const DEBOUNCE_MS = 250

const term = ref('')
// Saisie à laquelle correspond `results` : tant que la réponse du serveur n'est
// pas arrivée, la liste affichée serait celle d'une saisie précédente.
const resultsFor = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

function search(value: string) {
  term.value = value
  clearTimeout(timer)
  if (value.trim().length < MIN_LENGTH) return

  const requested = value.trim()
  timer = setTimeout(() => {
    // Inertia annule la visite précédente quand une nouvelle démarre : une
    // réponse tardive n'écrase donc pas une plus récente.
    router.reload({
      data: { productSearch: requested },
      only: ['productResults', 'productSearchUnavailable'],
      preserveUrl: true,
      onSuccess: () => (resultsFor.value = requested),
    })
  }, DEBOUNCE_MS)
}

function pick(product: RfqProductOptionType) {
  emit('pick', product)
  term.value = ''
  resultsFor.value = ''
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <section class="flex flex-col gap-3">
    <BaseInput
      id="rfq-product-search"
      :model-value="term"
      :label="t('rfq.product.label')"
      :placeholder="t('rfq.product.placeholder')"
      @update:model-value="search(String($event))"
    />

    <template v-if="term.trim().length >= MIN_LENGTH && results && resultsFor === term.trim()">
      <p v-if="unavailable" role="alert" class="text-sm text-[var(--gray-6)]">
        {{ t('rfq.product.unavailable') }}
      </p>
      <p v-else-if="results.length === 0" class="text-sm text-[var(--gray-6)]">
        {{ t('rfq.product.empty') }}
      </p>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="product in results"
          :key="product.id"
          class="flex items-center justify-between gap-4 rounded border border-[var(--gray-3)] p-3"
        >
          <div>
            <p class="font-medium">{{ product.name }}</p>
            <p v-if="product.supplierName" class="text-sm text-[var(--gray-6)]">
              {{ product.supplierName }}
            </p>
          </div>
          <BaseButton variant="secondary" @click="pick(product)">
            {{ t('rfq.product.add') }}
          </BaseButton>
        </li>
      </ul>
    </template>
  </section>
</template>
