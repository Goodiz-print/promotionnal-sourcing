<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import RfqItemsFields from '~/components/rfqs/rfq_items_fields.vue'
import RfqProductPicker from '~/components/rfqs/rfq_product_picker.vue'
import RfqSupplierPicker from '~/components/rfqs/rfq_supplier_picker.vue'
import { emptyRfqItem, itemFromProduct, type RfqFormState } from '~/components/rfqs/types'
import type { CategoryType } from '#shared/types/category'
import type { RfqDetailType, RfqProductOptionType, SupplierOptionType } from '#shared/types/rfq'

/**
 * Formulaire de demande, en création comme en édition d'un brouillon. Les
 * destinataires ne sont proposés qu'à la création : une fois la demande créée,
 * ils se gèrent depuis l'écran de détail (ajout possible même après
 * publication, retrait seulement tant qu'ils n'ont pas été notifiés).
 */
const props = defineProps<{
  mode: 'create' | 'edit'
  categories: CategoryType[]
  supplierOptions: SupplierOptionType[]
  rfq?: RfqDetailType
  // Produit d'une fiche (`?productId=`) : une ligne et son fournisseur d'emblée.
  prefill?: RfqProductOptionType
  // Réponse du dernier partial reload `productSearch` ; absente tant qu'on n'a rien cherché.
  productResults?: RfqProductOptionType[]
  productSearchUnavailable?: boolean
}>()

const emit = defineEmits<{ 'product-picked': [product: RfqProductOptionType] }>()

const { t, locale } = useI18n()

const form = useForm<RfqFormState>({
  title: props.rfq?.title ?? '',
  description: props.rfq?.description ?? '',
  // `<input type="date">` attend `YYYY-MM-DD` ; l'API renvoie un ISO complet.
  deadline: props.rfq?.deadline?.slice(0, 10) ?? '',
  budgetMax: props.rfq?.budgetMax ? Number(props.rfq.budgetMax) : null,
  items: props.rfq
    ? props.rfq.items.map((item) => ({
        name: item.name,
        description: item.description ?? '',
        quantity: item.quantity,
        unit: item.unit ?? '',
        categoryId: item.categoryId,
        productId: item.productId,
      }))
    : [props.prefill ? itemFromProduct(props.prefill) : emptyRfqItem()],
  supplierOrganizationIds: props.prefill?.supplierOrganizationId
    ? [props.prefill.supplierOrganizationId]
    : [],
})

/**
 * Un produit choisi dans le catalogue devient une ligne. À la création son
 * fournisseur est coché ; en édition, les destinataires se gèrent hors de ce
 * formulaire, d'où l'événement relayé à l'écran de détail.
 */
function pickProduct(product: RfqProductOptionType) {
  form.items = [...form.items, itemFromProduct(product)]
  const supplierId = product.supplierOrganizationId
  if (props.mode === 'create' && supplierId && !form.supplierOrganizationIds.includes(supplierId)) {
    form.supplierOrganizationIds = [...form.supplierOrganizationIds, supplierId]
  }
  emit('product-picked', product)
}

function submit() {
  // Les champs texte vides sont omis : VineJS les traite alors comme absents
  // plutôt que comme une chaîne vide invalide.
  form
    .transform((data) => ({
      title: data.title,
      description: data.description || null,
      deadline: data.deadline || null,
      budgetMax: data.budgetMax,
      items: data.items.map((item) => ({
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit: item.unit || null,
        categoryId: item.categoryId,
        productId: item.productId,
      })),
      ...(props.mode === 'create' ? { supplierOrganizationIds: data.supplierOrganizationIds } : {}),
    }))
    [props.mode === 'create' ? 'post' : 'patch'](
      props.mode === 'create'
        ? urlFor('rfqs.store', { locale: locale.value })
        : urlFor('rfqs.update', { locale: locale.value, id: props.rfq!.id }),
      { preserveScroll: true }
    )
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <BaseSection as="fieldset" :title="t('rfq.form.general')">
      <div class="flex flex-col gap-5">
        <BaseInput
          id="rfq-title"
          v-model="form.title"
          :label="t('rfq.fields.title')"
          :error="form.errors.title"
          required
        />

        <BaseTextarea
          id="rfq-description"
          v-model="form.description"
          :label="t('rfq.fields.description')"
          :error="form.errors.description"
        />

        <div class="grid gap-5 sm:grid-cols-2">
          <BaseInput
            id="rfq-deadline"
            v-model="form.deadline"
            type="date"
            :label="t('rfq.fields.deadline')"
            :error="form.errors.deadline"
          />
          <BaseInput
            id="rfq-budget"
            v-model="form.budgetMax"
            type="number"
            :min="1"
            :label="t('rfq.fields.budgetMax')"
            :error="form.errors.budgetMax"
          />
        </div>
      </div>
    </BaseSection>

    <BaseSection as="fieldset" :title="t('rfq.items.title')">
      <div class="flex flex-col gap-5">
        <RfqProductPicker
          :results="productResults"
          :unavailable="productSearchUnavailable"
          @pick="pickProduct"
        />

        <RfqItemsFields
          v-model="form.items"
          :categories="categories"
          :errors="form.errors as Record<string, string>"
        />
      </div>
    </BaseSection>

    <BaseSection
      v-if="mode === 'create'"
      as="fieldset"
      :title="t('rfq.fields.suppliers')"
      :description="t('rfq.suppliers.selected', { count: form.supplierOrganizationIds.length })"
    >
      <RfqSupplierPicker v-model="form.supplierOrganizationIds" :options="supplierOptions" />
    </BaseSection>

    <div class="flex justify-end gap-3">
      <BaseButton type="submit" :loading="form.processing">
        {{ mode === 'create' ? t('rfq.create.submit') : t('rfq.actions.save') }}
      </BaseButton>
    </div>
  </form>
</template>
