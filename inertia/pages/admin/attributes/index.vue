<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { ListFilter, Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AttributeAdminType } from '#shared/types/attribute'

defineProps<{ attributes: AttributeAdminType[] }>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()

const createUrl = computed(() => urlFor('admin.attributes.create', { locale: locale.value }))

async function destroy(attribute: AttributeAdminType) {
  const confirmed = await confirm({
    message: t('attributes.confirmDelete'),
    confirmLabel: t('attributes.delete'),
    tone: 'danger',
  })
  if (!confirmed) return
  router.delete(urlFor('admin.attributes.destroy', { locale: locale.value, id: attribute.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <Head :title="t('attributes.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('attributes.index.title')"
      :description="t('attributes.index.subtitle')"
    >
      <!-- Une seule action primaire par écran : l'état vide porte la sienne. -->
      <template v-if="attributes.length > 0" #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('attributes.newAttribute') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseEmptyState
      v-if="attributes.length === 0"
      :title="t('attributes.index.empty')"
      :description="t('attributes.index.emptyDescription')"
      :icon="ListFilter"
    >
      <template #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('attributes.newAttribute') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>

    <BaseTable v-else :caption="t('attributes.index.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('attributes.index.columns.name') }}</th>
          <th scope="col">{{ t('attributes.index.columns.slug') }}</th>
          <th scope="col">{{ t('attributes.index.columns.type') }}</th>
          <th scope="col">{{ t('attributes.index.columns.filterable') }}</th>
          <th scope="col" class="text-right">{{ t('attributes.index.columns.values') }}</th>
          <th scope="col" class="text-right">{{ t('attributes.index.columns.products') }}</th>
          <th scope="col" class="text-right">
            <span class="sr-only">{{ t('attributes.index.columns.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="attribute in attributes" :key="attribute.id">
        <td>
          <Link
            route="admin.attributes.edit"
            :params="{ locale, id: attribute.id }"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ attribute.name ?? attribute.slug }}
          </Link>
        </td>
        <td class="text-text-secondary">{{ attribute.slug }}</td>
        <td>
          {{ t(`attributes.types.${attribute.type}`) }}
          <span v-if="attribute.unit" class="text-text-muted">({{ attribute.unit }})</span>
        </td>
        <td>
          <BaseBadge :tone="attribute.isFilterable ? 'success' : 'neutral'">
            {{ attribute.isFilterable ? t('attributes.index.yes') : t('attributes.index.no') }}
          </BaseBadge>
        </td>
        <td class="text-tabular text-right">{{ attribute.valuesCount }}</td>
        <td class="text-tabular text-right">{{ attribute.productsCount }}</td>
        <td>
          <div class="flex items-center justify-end gap-2">
            <BaseLinkButton
              :href="urlFor('admin.attributes.edit', { locale, id: attribute.id })"
              size="sm"
              variant="secondary"
            >
              {{ t('attributes.edit') }}
            </BaseLinkButton>
            <BaseIconButton :label="t('attributes.delete')" @click="destroy(attribute)">
              <Trash2 :size="18" aria-hidden="true" />
            </BaseIconButton>
          </div>
        </td>
      </tr>
    </BaseTable>
  </div>
</template>
