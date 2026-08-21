<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base_badge.vue'
import BaseButton from '~/components/base_button.vue'
import RfqActions from '~/components/rfqs/rfq_actions.vue'
import RfqForm from '~/components/rfqs/rfq_form.vue'
import RfqSupplierList from '~/components/rfqs/rfq_supplier_list.vue'
import RfqSupplierPicker from '~/components/rfqs/rfq_supplier_picker.vue'
import { RFQ_STATUS_TONES } from '~/components/rfqs/types'
import type { CategoryType } from '#shared/types/category'
import type { RfqDetailType, SupplierOptionType } from '#shared/types/rfq'

const props = defineProps<{
  rfq: RfqDetailType
  categories: CategoryType[]
  supplierOptions: SupplierOptionType[]
  canManageRfq: boolean
}>()

const { t, locale } = useI18n()

/** Un brouillon s'édite en place ; une demande publiée se lit seulement. */
const isDraft = computed(() => props.rfq.status === 'draft')

/** Fournisseurs pas encore destinataires : les seuls qu'on puisse ajouter. */
const addableSuppliers = computed(() => {
  const targeted = new Set(props.rfq.suppliers.map((row) => row.supplierOrganizationId))
  return props.supplierOptions.filter((option) => !targeted.has(option.id))
})

const supplierIdsToAdd = ref<number[]>([])

function addSuppliers() {
  router.post(
    urlFor('rfqs.suppliers.store', { locale: locale.value, id: props.rfq.id }),
    { supplierOrganizationIds: supplierIdsToAdd.value },
    { preserveScroll: true, onSuccess: () => (supplierIdsToAdd.value = []) }
  )
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <Head :title="rfq.title" />

  <div class="mx-auto flex max-w-[860px] flex-col gap-8 px-6 py-12">
    <div>
      <Link
        route="rfqs.index"
        :params="{ locale }"
        class="text-sm text-[var(--color-primary)] hover:underline"
      >
        {{ t('rfq.show.backToList') }}
      </Link>

      <div class="mt-3 flex items-start justify-between gap-4">
        <h1 class="text-[32px] tracking-[-0.5px]">{{ rfq.title }}</h1>
        <BaseBadge :tone="RFQ_STATUS_TONES[rfq.status]">
          {{ t(`rfq.status.${rfq.status}`) }}
        </BaseBadge>
      </div>

      <p class="mt-1 text-sm text-[var(--gray-6)]">
        <span v-if="rfq.createdByName">
          {{ t('rfq.show.createdBy', { name: rfq.createdByName }) }} ·
        </span>
        <span>
          {{
            rfq.deadline
              ? t('rfq.show.deadline', { date: formatDate(rfq.deadline) })
              : t('rfq.show.noDeadline')
          }}
        </span>
        <span v-if="rfq.budgetMax"> · {{ t('rfq.show.budget', { amount: rfq.budgetMax }) }}</span>
      </p>
    </div>

    <RfqActions v-if="canManageRfq" :rfq="rfq" />

    <section v-if="isDraft && canManageRfq">
      <h2 class="mb-4 font-medium">{{ t('rfq.show.needTitle') }}</h2>
      <RfqForm
        mode="edit"
        :rfq="rfq"
        :categories="categories"
        :supplier-options="supplierOptions"
      />
    </section>

    <section v-else class="flex flex-col gap-3">
      <h2 class="font-medium">{{ t('rfq.show.needTitle') }}</h2>
      <p v-if="rfq.description" class="whitespace-pre-line text-[var(--gray-8)]">
        {{ rfq.description }}
      </p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="item in rfq.items"
          :key="item.id"
          class="rounded border border-[var(--gray-3)] p-3"
        >
          <div class="flex items-baseline justify-between gap-4">
            <p class="font-medium">{{ item.name }}</p>
            <span class="text-sm whitespace-nowrap text-[var(--gray-6)]">
              {{ item.quantity }} {{ item.unit }}
            </span>
          </div>
          <p v-if="item.description" class="mt-1 text-sm text-[var(--gray-6)]">
            {{ item.description }}
          </p>
          <p v-if="item.categoryName || item.productName" class="mt-1 text-sm text-[var(--gray-6)]">
            <span v-if="item.categoryName">
              {{ t('rfq.show.category') }} : {{ item.categoryName }}
            </span>
            <span v-if="item.productName">
              · {{ t('rfq.show.product') }} : {{ item.productName }}
            </span>
          </p>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-medium">{{ t('rfq.show.suppliersTitle') }}</h2>
      <RfqSupplierList :rfq-id="rfq.id" :suppliers="rfq.suppliers" :can-manage="canManageRfq" />

      <div
        v-if="canManageRfq && rfq.status !== 'closed' && addableSuppliers.length > 0"
        class="mt-4 flex flex-col gap-3 rounded border border-[var(--gray-3)] p-4"
      >
        <RfqSupplierPicker v-model="supplierIdsToAdd" :options="addableSuppliers" />
        <div>
          <BaseButton
            variant="secondary"
            :disabled="supplierIdsToAdd.length === 0"
            @click="addSuppliers()"
          >
            {{ t('rfq.show.addSuppliers') }}
          </BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>
