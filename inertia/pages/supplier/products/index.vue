<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Image as ImageIcon, Package, Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { ProductType } from '#shared/types/product'

defineProps<{ products: ProductType[] }>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()

const createUrl = computed(() => urlFor('supplier.products.create', { locale: locale.value }))

function editUrl(product: ProductType): string {
  return urlFor('supplier.products.edit', { locale: locale.value, id: product.id })
}

/**
 * Fourchette de prix du produit (`priceMin` – `priceMax`, décimaux sérialisés en
 * chaîne) ; une seule borne renseignée s'affiche seule, aucune donne une chaîne vide.
 */
function formatPrice(product: ProductType): string {
  const format = (value: string) =>
    new Intl.NumberFormat(locale.value, { style: 'currency', currency: product.currency }).format(
      Number(value)
    )
  if (product.priceMin && product.priceMax && product.priceMin !== product.priceMax) {
    return t('products.manage.index.priceRange', {
      min: format(product.priceMin),
      max: format(product.priceMax),
    })
  }
  const single = product.priceMin ?? product.priceMax
  return single ? format(single) : ''
}

async function destroy(product: ProductType) {
  const confirmed = await confirm({
    message: t('products.manage.confirmDelete'),
    confirmLabel: t('products.manage.delete'),
    tone: 'danger',
  })
  if (!confirmed) return
  router.delete(urlFor('supplier.products.destroy', { locale: locale.value, id: product.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <Head :title="t('products.manage.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('products.manage.index.title')">
      <!-- Une seule action primaire par écran : l'état vide porte la sienne. -->
      <template v-if="products.length > 0" #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('products.manage.newProduct') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseEmptyState
      v-if="products.length === 0"
      :title="t('products.manage.index.empty')"
      :description="t('products.manage.index.emptyDescription')"
      :icon="Package"
    >
      <template #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('products.manage.newProduct') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>

    <BaseTable v-else :caption="t('products.manage.index.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('products.manage.index.columns.product') }}</th>
          <th scope="col" class="text-right">{{ t('products.manage.index.columns.price') }}</th>
          <th scope="col">{{ t('products.manage.index.columns.status') }}</th>
          <th scope="col" class="text-right">
            <span class="sr-only">{{ t('products.manage.index.columns.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="product in products" :key="product.id">
        <td>
          <div class="flex items-center gap-3">
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
              alt=""
              class="size-10 shrink-0 rounded-md bg-sunken object-cover"
            />
            <span
              v-else
              class="flex size-10 shrink-0 items-center justify-center rounded-md bg-sunken text-text-muted"
              aria-hidden="true"
            >
              <ImageIcon :size="18" />
            </span>
            <div class="flex min-w-0 flex-col">
              <Link
                route="supplier.products.edit"
                :params="{ locale, id: product.id }"
                class="truncate font-semibold text-text-primary hover:text-indigo-600"
              >
                {{ product.name ?? product.slug }}
              </Link>
              <span v-if="product.reference" class="text-caption text-text-muted">
                {{ product.reference }}
              </span>
            </div>
          </div>
        </td>
        <td class="text-tabular text-right whitespace-nowrap">
          <template v-if="formatPrice(product)">{{ formatPrice(product) }}</template>
          <span v-else class="text-text-muted">{{ t('products.manage.index.noPrice') }}</span>
        </td>
        <td>
          <BaseBadge dot :tone="product.isActive ? 'success' : 'neutral'">
            {{ product.isActive ? t('products.manage.published') : t('products.manage.draft') }}
          </BaseBadge>
        </td>
        <td>
          <div class="flex items-center justify-end gap-2">
            <BaseLinkButton :href="editUrl(product)" size="sm" variant="secondary">
              {{ t('products.manage.edit') }}
            </BaseLinkButton>
            <BaseIconButton :label="t('products.manage.delete')" @click="destroy(product)">
              <Trash2 :size="18" aria-hidden="true" />
            </BaseIconButton>
          </div>
        </td>
      </tr>
    </BaseTable>
  </div>
</template>
