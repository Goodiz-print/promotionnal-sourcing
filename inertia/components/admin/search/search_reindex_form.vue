<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { DatabaseZap } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminSearchSupplierOption } from '#shared/types/admin_search'

/**
 * Réindexation depuis PostgreSQL, traitée par la queue : complète (index
 * reconstruit à côté puis échangé, l'ancien reste en place en cas d'échec) ou
 * limitée aux produits d'un fournisseur.
 */
defineProps<{ enabled: boolean; busy: boolean; suppliers: AdminSearchSupplierOption[] }>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()
const supplierId = ref<number | null>(null)
const sending = ref(false)
const scope = computed(() => supplierId.value !== null)

async function submit() {
  const keys = scope.value
    ? {
        message: 'admin.search.reindex.confirmSupplier',
        label: 'admin.search.reindex.submitSupplier',
      }
    : { message: 'admin.search.reindex.confirm', label: 'admin.search.reindex.submit' }
  if (!(await confirm({ message: t(keys.message), confirmLabel: t(keys.label) }))) return

  router.post(
    urlFor('admin.search.reindex', { locale: locale.value }),
    supplierId.value === null ? {} : { supplierId: supplierId.value },
    {
      preserveScroll: true,
      onStart: () => (sending.value = true),
      onFinish: () => (sending.value = false),
    }
  )
}
</script>

<template>
  <BaseSection
    :title="t('admin.search.reindex.title')"
    :description="t('admin.search.reindex.hint')"
  >
    <form class="flex flex-wrap items-end gap-4" @submit.prevent="submit">
      <BaseSelect
        id="search-reindex-supplier"
        v-model="supplierId"
        :label="t('admin.search.reindex.supplier')"
        :hint="t('admin.search.reindex.supplierHint')"
      >
        <option :value="null">{{ t('admin.search.reindex.allSuppliers') }}</option>
        <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
          {{ supplier.name }}
        </option>
      </BaseSelect>
      <BaseButton type="submit" :disabled="!enabled || busy || sending">
        <DatabaseZap :size="16" aria-hidden="true" />
        {{ t(scope ? 'admin.search.reindex.submitSupplier' : 'admin.search.reindex.submit') }}
      </BaseButton>
    </form>
  </BaseSection>
</template>
