<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseButton from '~/components/base/base_button.vue'
import ProductMarkingPositionRow from '~/components/products/form/product_marking_position_row.vue'
import ProductMarkingPriceTiersFields from '~/components/products/form/product_marking_price_tiers_fields.vue'
import type { MarkingTechniqueType } from '#shared/types/marking'
import type { ProductDocumentFile } from '#shared/types/document'
import { ProductFormKey } from './types'

const props = defineProps<{
  markingTechniques: MarkingTechniqueType[]
  documents: ProductDocumentFile[]
}>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

// Gabarits sélectionnables : documents du produit de type `marking_template`.
const templateDocuments = computed(() =>
  props.documents.filter((document) => document.type === 'marking_template')
)

function addPosition() {
  form.markingPositions = [
    ...form.markingPositions,
    { name: '', maxWidthMm: null, maxHeightMm: null, templateDocumentId: null, techniques: [] },
  ]
}

function removePosition(index: number) {
  form.markingPositions = form.markingPositions.filter((_, current) => current !== index)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <BaseCheckbox
      id="printable"
      v-model="form.printable"
      :label="t('products.manage.marking.printable')"
    />

    <p class="text-sm text-[var(--gray-6)]">{{ t('products.manage.marking.hint') }}</p>

    <p v-if="form.markingPositions.length === 0" class="text-sm text-[var(--gray-6)]">
      {{ t('products.manage.marking.empty') }}
    </p>
    <ProductMarkingPositionRow
      v-for="(_, index) in form.markingPositions"
      :key="index"
      :index="index"
      :marking-techniques="markingTechniques"
      :template-documents="templateDocuments"
      @remove="removePosition(index)"
    />
    <div>
      <BaseButton variant="secondary" @click="addPosition">{{
        t('products.manage.marking.addPosition')
      }}</BaseButton>
    </div>

    <div>
      <h3 class="mb-2 text-sm font-medium">{{ t('products.manage.marking.priceTiers') }}</h3>
      <ProductMarkingPriceTiersFields :marking-techniques="markingTechniques" />
    </div>
  </div>
</template>
