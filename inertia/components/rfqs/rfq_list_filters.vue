<script setup lang="ts">
import { computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { RotateCcw } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { hasActiveRfqFilters, rfqListQuery } from '#shared/helpers/rfq_list'
import { RFQ_PROGRESSES } from '#shared/types/rfq'
import type { RfqAuthorOptionType, RfqBuyerFiltersType } from '#shared/types/rfq'

/**
 * Filtres de « Mes demandes » (#228) : avancement et auteur. Chaque choix
 * relance la visite Inertia avec les filtres en query string (URL partageable,
 * historique du navigateur) ; les filtres affichés sont ceux du serveur.
 */
const props = defineProps<{
  filters: RfqBuyerFiltersType
  authors: RfqAuthorOptionType[]
}>()

const { t, locale } = useI18n()

const isFiltered = computed(() => hasActiveRfqFilters(props.filters))

function visit(filters: RfqBuyerFiltersType) {
  router.get(urlFor('rfqs.index', { locale: locale.value }), rfqListQuery(filters), {
    preserveState: true,
    preserveScroll: true,
    replace: true,
  })
}

const status = computed({
  get: () => props.filters.status,
  set: (value) => visit({ ...props.filters, status: value }),
})

const authorId = computed({
  get: () => props.filters.authorId,
  set: (value) => visit({ ...props.filters, authorId: value }),
})
</script>

<template>
  <div
    role="search"
    :aria-label="t('rfq.index.filters.label')"
    class="flex flex-col gap-4 sm:flex-row sm:items-end"
  >
    <div class="grid flex-1 gap-4 sm:grid-cols-2">
      <BaseSelect id="rfq-filter-status" v-model="status" :label="t('rfq.index.filters.status')">
        <option :value="null">{{ t('rfq.index.filters.allStatuses') }}</option>
        <option v-for="progress in RFQ_PROGRESSES" :key="progress" :value="progress">
          {{ t(`rfq.index.progress.${progress}`) }}
        </option>
      </BaseSelect>
      <BaseSelect id="rfq-filter-author" v-model="authorId" :label="t('rfq.index.filters.author')">
        <option :value="null">{{ t('rfq.index.filters.allAuthors') }}</option>
        <option v-for="author in authors" :key="author.id" :value="author.id">
          {{ author.name }}
        </option>
      </BaseSelect>
    </div>
    <BaseButton
      v-if="isFiltered"
      variant="ghost"
      size="sm"
      @click="visit({ status: null, authorId: null })"
    >
      <RotateCcw :size="16" aria-hidden="true" />
      {{ t('rfq.index.filters.reset') }}
    </BaseButton>
  </div>
</template>
