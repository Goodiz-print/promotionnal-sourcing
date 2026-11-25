<script setup lang="ts">
import { computed } from 'vue'
import { Archive, ArchiveRestore, Eye, EyeOff, RefreshCw, Send } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useAdminProductActions } from '~/composables/use_admin_product_actions'
import ProductHideForm from '~/components/admin/product/product_hide_form.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import { ICON_SIZE, type ConfirmOptions } from '~/types/ui'
import type { AdminProductAction, AdminProductDetail } from '#shared/types/admin_product'

/**
 * Actions de gestion d'un produit, selon son état : un produit archivé ne peut
 * qu'être restauré ou réindexé ; sinon masquer / révéler, publier / dépublier,
 * archiver et réindexer. Le serveur re-vérifie le droit et l'état.
 */
const props = defineProps<{ product: AdminProductDetail }>()

const { t } = useI18n()
const { processing, run } = useAdminProductActions(props.product.id)

const archived = computed(() => props.product.lifecycleStatus === 'retired')
const hidden = computed(() => props.product.moderationStatus === 'rejected')
/** Confirmation d'une action : son message, son bouton ; l'archivage est `danger`. */
const confirmation = (action: AdminProductAction): ConfirmOptions => ({
  message: t(`admin.products.actions.${action}.confirm`),
  confirmLabel: t(`admin.products.actions.${action}.label`),
  tone: action === 'archive' ? 'danger' : 'default',
})
</script>

<template>
  <BaseSection :title="t('admin.products.detail.actionsTitle')">
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap gap-3">
        <template v-if="archived">
          <BaseButton
            variant="secondary"
            :disabled="processing"
            @click="run('restore', confirmation('restore'))"
          >
            <template #icon><ArchiveRestore :size="ICON_SIZE" aria-hidden="true" /></template>
            {{ t('admin.products.actions.restore.label') }}
          </BaseButton>
        </template>
        <template v-else>
          <BaseButton
            v-if="hidden"
            variant="secondary"
            :disabled="processing"
            @click="run('unhide', confirmation('unhide'))"
          >
            <template #icon><Eye :size="ICON_SIZE" aria-hidden="true" /></template>
            {{ t('admin.products.actions.unhide.label') }}
          </BaseButton>
          <BaseButton
            v-if="product.isActive"
            variant="secondary"
            :disabled="processing"
            @click="run('unpublish', confirmation('unpublish'))"
          >
            <template #icon><EyeOff :size="ICON_SIZE" aria-hidden="true" /></template>
            {{ t('admin.products.actions.unpublish.label') }}
          </BaseButton>
          <BaseButton
            v-else
            variant="secondary"
            :disabled="processing"
            @click="run('publish', confirmation('publish'))"
          >
            <template #icon><Send :size="ICON_SIZE" aria-hidden="true" /></template>
            {{ t('admin.products.actions.publish.label') }}
          </BaseButton>
          <BaseButton
            variant="danger"
            :disabled="processing"
            @click="run('archive', confirmation('archive'))"
          >
            <template #icon><Archive :size="ICON_SIZE" aria-hidden="true" /></template>
            {{ t('admin.products.actions.archive.label') }}
          </BaseButton>
        </template>
        <BaseButton
          variant="ghost"
          :disabled="processing"
          @click="run('reindex', confirmation('reindex'))"
        >
          <template #icon><RefreshCw :size="ICON_SIZE" aria-hidden="true" /></template>
          {{ t('admin.products.actions.reindex.label') }}
        </BaseButton>
      </div>

      <ProductHideForm v-if="!archived && !hidden" :product-id="product.id" />
    </div>
  </BaseSection>
</template>
