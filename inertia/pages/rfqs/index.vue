<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { FileText, Plus, SearchX } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import RfqListFilters from '~/components/rfqs/rfq_list_filters.vue'
import RfqListTable from '~/components/rfqs/rfq_list_table.vue'
import { hasActiveRfqFilters } from '#shared/helpers/rfq_list'
import type { RfqAuthorOptionType, RfqBatchGroupType, RfqBuyerFiltersType } from '#shared/types/rfq'

/**
 * « Mes demandes » (#228) : les demandes de l'agence, regroupées par panier,
 * filtrables par avancement et par auteur.
 */
const props = defineProps<{
  groups: RfqBatchGroupType[]
  filters: RfqBuyerFiltersType
  authors: RfqAuthorOptionType[]
  canSendRfq: boolean
  canManageRfq: boolean
}>()

const { t, locale } = useI18n()

const createUrl = computed(() => urlFor('rfqs.create', { locale: locale.value }))
const indexUrl = computed(() => urlFor('rfqs.index', { locale: locale.value }))

const isFiltered = computed(() => hasActiveRfqFilters(props.filters))
const isEmpty = computed(() => props.groups.length === 0)
/** Aucune demande du tout (et non « aucune pour ces filtres »). */
const hasNoRfq = computed(() => isEmpty.value && !isFiltered.value)
</script>

<template>
  <Head :title="t('rfq.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('rfq.index.title')" :description="t('rfq.index.subtitle')">
      <!-- Une seule action primaire par écran : l'état vide porte la sienne. -->
      <template v-if="!hasNoRfq" #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('rfq.index.new') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseEmptyState
      v-if="hasNoRfq"
      :title="t('rfq.index.empty')"
      :description="t('rfq.index.emptyDescription')"
      :icon="FileText"
    >
      <template #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('rfq.index.new') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>

    <template v-else>
      <RfqListFilters :filters="filters" :authors="authors" />

      <BaseEmptyState
        v-if="isEmpty"
        :title="t('rfq.index.noMatch')"
        :description="t('rfq.index.noMatchDescription')"
        :icon="SearchX"
      >
        <template #actions>
          <BaseLinkButton :href="indexUrl" variant="secondary">
            {{ t('rfq.index.filters.reset') }}
          </BaseLinkButton>
        </template>
      </BaseEmptyState>

      <RfqListTable v-else :groups="groups" />
    </template>
  </div>
</template>
