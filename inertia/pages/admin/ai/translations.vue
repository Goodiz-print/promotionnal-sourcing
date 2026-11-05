<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Languages } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AiTranslationRow from '~/components/admin/ai/ai_translation_row.vue'
import TradeList from '~/components/admin/trade_list.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { CONTENT_LOCALE_LABELS, type ContentLocale } from '#shared/types/i18n'
import type {
  AdminAiTranslationFilters,
  AdminAiTranslationRow,
  AiTranslationOrigin,
} from '#shared/types/admin_ai'
import type { TranslatableEntity } from '#shared/types/ai'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  reviews: Paginated<AdminAiTranslationRow>
  filters: AdminAiTranslationFilters
  entities: TranslatableEntity[]
  locales: string[]
  origins: AiTranslationOrigin[]
}>()

const { t, locale } = useI18n()

const model = reactive({ ...props.filters })
// Les filtres du serveur font foi (retour arrière, pagination…).
watch(
  () => props.filters,
  () => Object.assign(model, props.filters),
  { deep: true }
)

function visit(page = 1) {
  const query: Record<string, string | number> = { page, entity: model.entity }
  if (model.locale) query.locale = model.locale
  if (model.origin) query.origin = model.origin
  if (model.search?.trim()) query.search = model.search.trim()
  router.get(urlFor('admin.ai.translations', { locale: locale.value }), query, {
    preserveState: true,
    preserveScroll: true,
    only: ['reviews', 'filters'],
  })
}

function reset() {
  Object.assign(model, { entity: 'product', locale: null, origin: 'auto', search: null })
  visit()
}
</script>

<template>
  <Head :title="t('admin.ai.translations.title')" />

  <TradeList
    :title="t('admin.ai.translations.title')"
    :description="t('admin.ai.translations.subtitle')"
    :count-label="t('admin.ai.translations.resultsCount', { count: reviews.meta.total })"
    :empty-title="t('admin.ai.translations.empty')"
    :empty-description="t('admin.ai.translations.emptyDescription')"
    :icon="Languages"
    :meta="reviews.meta"
    @page="visit"
  >
    <template #filters>
      <BaseCard padding="md">
        <form class="flex flex-col gap-4" @submit.prevent="visit()">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BaseSelect
              id="ai-entity"
              v-model="model.entity"
              :label="t('admin.ai.translations.filters.entity')"
            >
              <option v-for="entity in entities" :key="entity" :value="entity">
                {{ t(`admin.ai.entities.${entity}`) }}
              </option>
            </BaseSelect>
            <BaseSelect
              id="ai-locale"
              v-model="model.locale"
              :label="t('admin.ai.translations.filters.language')"
            >
              <option :value="null">{{ t('admin.ai.translations.filters.all') }}</option>
              <option v-for="code in locales" :key="code" :value="code">
                {{ CONTENT_LOCALE_LABELS[code as ContentLocale] ?? code }}
              </option>
            </BaseSelect>
            <BaseSelect
              id="ai-origin"
              v-model="model.origin"
              :label="t('admin.ai.translations.filters.origin')"
            >
              <option :value="null">{{ t('admin.ai.translations.filters.all') }}</option>
              <option v-for="origin in origins" :key="origin" :value="origin">
                {{ t(`admin.ai.origins.${origin}`) }}
              </option>
            </BaseSelect>
            <BaseInput
              id="ai-search"
              :model-value="model.search ?? ''"
              :label="t('admin.ai.translations.filters.search')"
              @update:model-value="model.search = $event"
            />
          </div>
          <div class="flex justify-end gap-3">
            <BaseButton variant="secondary" size="sm" @click="reset">
              {{ t('admin.trade.filters.reset') }}
            </BaseButton>
            <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
          </div>
        </form>
      </BaseCard>
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.ai.columns.id') }}</th>
        <th scope="col">{{ t('admin.ai.columns.language') }}</th>
        <th scope="col">{{ t('admin.ai.columns.text') }}</th>
        <th scope="col">{{ t('admin.ai.columns.origin') }}</th>
      </tr>
    </template>

    <AiTranslationRow
      v-for="row in reviews.data"
      :key="`${row.entity}-${row.entityId}-${row.locale}-${row.updatedAt}`"
      :row="row"
    />
  </TradeList>
</template>
