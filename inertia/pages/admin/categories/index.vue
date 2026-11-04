<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { ArrowDown, ArrowUp, FolderTree, Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { CategoryAdminType, CategoryMoveDirection } from '#shared/types/category'

defineProps<{ categories: CategoryAdminType[] }>()

const { t, locale } = useI18n()

/** Indentation par niveau d'arbre (classes statiques pour Tailwind ; au-delà, le dernier niveau). */
const DEPTH_INDENT = ['ps-0', 'ps-6', 'ps-12', 'ps-16']

const createUrl = computed(() => urlFor('admin.categories.create', { locale: locale.value }))

/** Un déplacement à la fois : un double-clic ne doit pas déplacer de deux crans. */
const moving = ref(false)

function move(category: CategoryAdminType, direction: CategoryMoveDirection) {
  if (moving.value) return
  router.patch(
    urlFor('admin.categories.move', { locale: locale.value, id: category.id }),
    { direction },
    {
      preserveScroll: true,
      onStart: () => (moving.value = true),
      onFinish: () => (moving.value = false),
    }
  )
}

function destroy(category: CategoryAdminType) {
  if (!window.confirm(t('categories.confirmDelete'))) return
  router.delete(urlFor('admin.categories.destroy', { locale: locale.value, id: category.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <Head :title="t('categories.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('categories.index.title')"
      :description="t('categories.index.subtitle')"
    >
      <!-- Une seule action primaire par écran : l'état vide porte la sienne. -->
      <template v-if="categories.length > 0" #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('categories.newCategory') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseEmptyState
      v-if="categories.length === 0"
      :title="t('categories.index.empty')"
      :description="t('categories.index.emptyDescription')"
      :icon="FolderTree"
    >
      <template #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('categories.newCategory') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>

    <BaseTable v-else :caption="t('categories.index.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('categories.index.columns.name') }}</th>
          <th scope="col">{{ t('categories.index.columns.slug') }}</th>
          <th scope="col">{{ t('categories.index.columns.parent') }}</th>
          <th scope="col" class="text-right">{{ t('categories.index.columns.products') }}</th>
          <th scope="col" class="text-right">
            <span class="sr-only">{{ t('categories.index.columns.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="category in categories" :key="category.id">
        <td>
          <div :class="DEPTH_INDENT[Math.min(category.depth, DEPTH_INDENT.length - 1)]">
            <Link
              route="admin.categories.edit"
              :params="{ locale, id: category.id }"
              class="font-semibold text-text-primary hover:text-indigo-600"
            >
              {{ category.name ?? category.slug }}
            </Link>
          </div>
        </td>
        <td class="text-text-secondary">{{ category.slug }}</td>
        <td>
          <template v-if="category.parentName">{{ category.parentName }}</template>
          <span v-else class="text-text-muted">{{ t('categories.index.root') }}</span>
        </td>
        <td class="text-tabular text-right">{{ category.productsCount }}</td>
        <td>
          <div class="flex items-center justify-end gap-2">
            <BaseIconButton
              :label="t('categories.index.moveUp')"
              :disabled="!category.canMoveUp || moving"
              @click="move(category, 'up')"
            >
              <ArrowUp :size="18" aria-hidden="true" />
            </BaseIconButton>
            <BaseIconButton
              :label="t('categories.index.moveDown')"
              :disabled="!category.canMoveDown || moving"
              @click="move(category, 'down')"
            >
              <ArrowDown :size="18" aria-hidden="true" />
            </BaseIconButton>
            <BaseLinkButton
              :href="urlFor('admin.categories.edit', { locale, id: category.id })"
              size="sm"
              variant="secondary"
            >
              {{ t('categories.edit') }}
            </BaseLinkButton>
            <BaseIconButton :label="t('categories.delete')" @click="destroy(category)">
              <Trash2 :size="18" aria-hidden="true" />
            </BaseIconButton>
          </div>
        </td>
      </tr>
    </BaseTable>
  </div>
</template>
