<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { DatabaseZap } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'

/**
 * Réindexation depuis PostgreSQL, traitée par la queue : complète (index
 * reconstruit à côté puis échangé, l'ancien reste en place en cas d'échec) ou
 * limitée aux produits d'un fournisseur.
 */
defineProps<{ enabled: boolean; busy: boolean }>()

const { t, locale } = useI18n()
// Un champ numérique renvoie un nombre une fois saisi, une chaîne vide sinon.
const supplierId = ref<string | number | null>('')
const sending = ref(false)
const scope = computed(() => String(supplierId.value ?? '').trim())

function submit() {
  const confirmation = scope.value
    ? 'admin.search.reindex.confirmSupplier'
    : 'admin.search.reindex.confirm'
  if (!window.confirm(t(confirmation))) return

  router.post(
    urlFor('admin.search.reindex', { locale: locale.value }),
    scope.value ? { supplierId: Number(scope.value) } : {},
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
      <BaseInput
        id="search-reindex-supplier"
        v-model="supplierId"
        type="number"
        :label="t('admin.search.reindex.supplier')"
        :hint="t('admin.search.reindex.supplierHint')"
      />
      <BaseButton type="submit" :disabled="!enabled || busy || sending">
        <DatabaseZap :size="16" aria-hidden="true" />
        {{ t(scope ? 'admin.search.reindex.submitSupplier' : 'admin.search.reindex.submit') }}
      </BaseButton>
    </form>
  </BaseSection>
</template>
