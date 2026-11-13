<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'

/**
 * Ajustement manuel d'un portefeuille publicitaire par l'équipe : crédit
 * (montant positif) ou débit (négatif), avec un motif tracé au journal d'audit.
 */
const { t, locale } = useI18n()

const form = useForm<{ organizationId: number | null; amount: number | null; note: string }>({
  organizationId: null,
  amount: null,
  note: '',
})

function submit() {
  form.post(urlFor('admin.ads.wallets.adjust', { locale: locale.value }), {
    preserveScroll: true,
    onSuccess: () => form.reset(),
  })
}
</script>

<template>
  <BaseSection
    :title="t('admin.ads.adjust.title')"
    :description="t('admin.ads.adjust.description')"
  >
    <form
      class="grid gap-6 md:grid-cols-[160px_160px_minmax(0,1fr)_auto] md:items-start"
      @submit.prevent="submit"
    >
      <BaseInput
        id="ad-adjust-organization"
        v-model="form.organizationId"
        type="number"
        :label="t('admin.ads.adjust.organizationId')"
        :error="form.errors.organizationId"
        min="1"
        step="1"
        required
      />
      <BaseInput
        id="ad-adjust-amount"
        v-model="form.amount"
        type="number"
        :label="t('admin.ads.adjust.amount')"
        :hint="t('admin.ads.adjust.amountHint')"
        :error="form.errors.amount"
        step="0.01"
        required
      />
      <BaseInput
        id="ad-adjust-note"
        v-model="form.note"
        :label="t('admin.ads.adjust.note')"
        :error="form.errors.note"
        required
      />
      <BaseButton type="submit" class="md:mt-7" :loading="form.processing">
        {{ t('admin.ads.adjust.submit') }}
      </BaseButton>
    </form>
  </BaseSection>
</template>
