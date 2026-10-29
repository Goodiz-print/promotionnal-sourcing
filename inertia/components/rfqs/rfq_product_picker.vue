<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Plus, Search } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import type { RfqProductOptionType } from '#shared/types/rfq'

/**
 * Recherche dans le catalogue pour remplir une ligne de demande. La recherche
 * passe par un **partial reload** de la page courante
 * (`only: ['productResults', 'productSearchUnavailable']`) : le serveur ne calcule la prop que sur
 * demande, et l'état du formulaire n'est pas touché (`preserveState`).
 *
 * Le moteur derrière est Meilisearch (#112, ADR 0002) : `unavailable` signale qu'il est
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
  <div class="flex flex-col gap-3">
    <BaseInput
      id="rfq-product-search"
      type="search"
      :model-value="term"
      :label="t('rfq.product.label')"
      :placeholder="t('rfq.product.placeholder')"
      @update:model-value="search(String($event))"
    >
      <template #prefix><Search :size="16" aria-hidden="true" /></template>
    </BaseInput>

    <template v-if="term.trim().length >= MIN_LENGTH && results && resultsFor === term.trim()">
      <p v-if="unavailable" role="alert" class="text-body-sm text-text-muted">
        {{ t('rfq.product.unavailable') }}
      </p>
      <p v-else-if="results.length === 0" class="text-body-sm text-text-muted">
        {{ t('rfq.product.empty') }}
      </p>
      <ul
        v-else
        class="flex flex-col rounded-lg border border-hairline bg-card p-1 shadow-elevation-2"
      >
        <li v-for="product in results" :key="product.id">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-500"
            @click="pick(product)"
          >
            <span class="flex min-w-0 flex-col">
              <span class="truncate text-body-sm font-semibold text-text-primary">
                {{ product.name }}
              </span>
              <span v-if="product.supplierName" class="text-caption text-text-muted">
                {{ product.supplierName }}
              </span>
            </span>
            <span
              class="inline-flex shrink-0 items-center gap-1 text-body-sm font-semibold text-indigo-600"
            >
              <Plus :size="16" aria-hidden="true" />
              {{ t('rfq.product.add') }}
            </span>
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>
