<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Brush, Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import { urlFor } from '~/client'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { MarkingTechniqueAdminType } from '#shared/types/marking'

defineProps<{ techniques: MarkingTechniqueAdminType[] }>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()

const createUrl = computed(() =>
  urlFor('admin.marking_techniques.create', { locale: locale.value })
)

async function destroy(technique: MarkingTechniqueAdminType) {
  const confirmed = await confirm({
    message: t('markingTechniques.confirmDelete'),
    confirmLabel: t('markingTechniques.delete'),
    tone: 'danger',
  })
  if (!confirmed) return
  router.delete(
    urlFor('admin.marking_techniques.destroy', { locale: locale.value, id: technique.id }),
    { preserveScroll: true }
  )
}
</script>

<template>
  <Head :title="t('markingTechniques.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('markingTechniques.index.title')"
      :description="t('markingTechniques.index.subtitle')"
    >
      <!-- Une seule action primaire par écran : l'état vide porte la sienne. -->
      <template v-if="techniques.length > 0" #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('markingTechniques.newTechnique') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseEmptyState
      v-if="techniques.length === 0"
      :title="t('markingTechniques.index.empty')"
      :description="t('markingTechniques.index.emptyDescription')"
      :icon="Brush"
    >
      <template #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('markingTechniques.newTechnique') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>

    <BaseTable v-else :caption="t('markingTechniques.index.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('markingTechniques.index.columns.name') }}</th>
          <th scope="col">{{ t('markingTechniques.index.columns.slug') }}</th>
          <th scope="col">{{ t('markingTechniques.index.columns.family') }}</th>
          <th scope="col" class="text-right">
            {{ t('markingTechniques.index.columns.products') }}
          </th>
          <th scope="col" class="text-right">
            <span class="sr-only">{{ t('markingTechniques.index.columns.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="technique in techniques" :key="technique.id">
        <td>
          <Link
            route="admin.marking_techniques.edit"
            :params="{ locale, id: technique.id }"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ technique.name ?? technique.slug }}
          </Link>
        </td>
        <td class="text-text-secondary">{{ technique.slug }}</td>
        <td>{{ t(`markingTechniques.families.${technique.family}`) }}</td>
        <td class="text-tabular text-right">{{ technique.productsCount }}</td>
        <td>
          <div class="flex items-center justify-end gap-2">
            <BaseLinkButton
              :href="urlFor('admin.marking_techniques.edit', { locale, id: technique.id })"
              size="sm"
              variant="secondary"
            >
              {{ t('markingTechniques.edit') }}
            </BaseLinkButton>
            <BaseIconButton :label="t('markingTechniques.delete')" @click="destroy(technique)">
              <Trash2 :size="18" aria-hidden="true" />
            </BaseIconButton>
          </div>
        </td>
      </tr>
    </BaseTable>
  </div>
</template>
