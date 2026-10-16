<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import RfqItemsFields from '~/components/rfqs/rfq_items_fields.vue'
import RfqSupplierPicker from '~/components/rfqs/rfq_supplier_picker.vue'
import { emptyRfqItem, type RfqFormState } from '~/components/rfqs/types'
import type { CategoryType } from '#shared/types/category'
import type { RfqDetailType, SupplierOptionType } from '#shared/types/rfq'

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
}>()

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
      }))
    : [emptyRfqItem()],
  supplierOrganizationIds: [],
})

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
    <BaseInput
      id="rfq-title"
      v-model="form.title"
      :label="t('rfq.fields.title')"
      :error="form.errors.title"
    />

    <BaseTextarea
      id="rfq-description"
      v-model="form.description"
      :label="t('rfq.fields.description')"
      :error="form.errors.description"
    />

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
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

    <RfqItemsFields
      v-model="form.items"
      :categories="categories"
      :errors="form.errors as Record<string, string>"
    />

    <RfqSupplierPicker
      v-if="mode === 'create'"
      v-model="form.supplierOrganizationIds"
      :options="supplierOptions"
    />

    <div>
      <BaseButton type="submit" :disabled="form.processing">
        {{ mode === 'create' ? t('rfq.create.submit') : t('rfq.actions.save') }}
      </BaseButton>
    </div>
  </form>
</template>
