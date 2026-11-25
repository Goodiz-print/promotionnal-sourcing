<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { CreditCard } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdFormat } from '~/composables/use_ad_format'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import { AD_MAX_TOP_UP_CENTS, AD_MIN_TOP_UP_CENTS, type AdWalletType } from '#shared/types/ads'

/**
 * Portefeuille publicitaire : solde et recharge en ligne. La recharge ouvre la
 * page de paiement hébergée par le prestataire ; sans paiement en ligne
 * configuré, le formulaire laisse place à un message.
 */
defineProps<{ wallet: AdWalletType }>()

const { t, locale } = useI18n()
const { money } = useAdFormat()

const form = useForm<{ amount: number | null }>({ amount: 50 })

function submit() {
  form.post(urlFor('supplier.ads.wallet.top_up', { locale: locale.value }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <BaseSection :title="t('ads.wallet.title')" :description="t('ads.wallet.description')">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="flex flex-col gap-1">
        <span class="text-caption font-semibold text-text-muted">{{
          t('ads.wallet.balance')
        }}</span>
        <span class="font-heading text-tabular text-display-lg text-text-primary">
          {{ money(wallet.balanceCents) }}
        </span>
      </div>

      <form
        v-if="wallet.topUpEnabled"
        class="flex flex-col gap-3 sm:flex-row sm:items-end"
        @submit.prevent="submit"
      >
        <BaseInput
          id="ad-top-up-amount"
          v-model="form.amount"
          type="number"
          :label="t('ads.wallet.amount')"
          :hint="
            t('ads.wallet.amountHint', {
              min: money(AD_MIN_TOP_UP_CENTS),
              max: money(AD_MAX_TOP_UP_CENTS),
            })
          "
          :error="form.errors.amount"
          :min="AD_MIN_TOP_UP_CENTS / 100"
          :max="AD_MAX_TOP_UP_CENTS / 100"
          step="0.01"
          required
        />
        <BaseButton type="submit" :loading="form.processing">
          <template #icon><CreditCard aria-hidden="true" /></template>
          {{ t('ads.wallet.topUp') }}
        </BaseButton>
      </form>
      <BaseAlert v-else tone="info" class="lg:max-w-md">
        {{ t('ads.wallet.unavailable') }}
      </BaseAlert>
    </div>
  </BaseSection>
</template>
