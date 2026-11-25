<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdFormat } from '~/composables/use_ad_format'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import {
  AD_MAX_CPC_CENTS,
  AD_MIN_CPC_CENTS,
  AD_MIN_DAILY_BUDGET_CENTS,
  type AdCampaignType,
  type AdProductOptionType,
} from '#shared/types/ads'

/**
 * Formulaire d'une campagne. Création : `products` liste les produits encore
 * sans campagne. Modification : `campaign` pré-remplit, le produit ne change pas.
 * Les montants sont saisis en euros ; le serveur les convertit en centimes.
 */
const props = defineProps<{ products?: AdProductOptionType[]; campaign?: AdCampaignType }>()

const { t, locale } = useI18n()
const { money } = useAdFormat()

const form = useForm<{
  productId: number | null
  maxCpc: number | null
  dailyBudget: number | null
  startsOn: string
  endsOn: string
}>({
  productId: props.campaign?.productId ?? null,
  maxCpc: props.campaign ? props.campaign.maxCpcCents / 100 : 0.3,
  dailyBudget: props.campaign ? props.campaign.dailyBudgetCents / 100 : 10,
  startsOn: props.campaign?.startsOn ?? new Date().toISOString().slice(0, 10),
  endsOn: props.campaign?.endsOn ?? '',
})

const indexUrl = urlFor('supplier.ads.index', { locale: locale.value })

function submit() {
  // Date de fin vide = campagne sans fin.
  const payload = form.transform((data) => ({ ...data, endsOn: data.endsOn || null }))
  if (props.campaign) {
    payload.patch(urlFor('supplier.ads.update', { locale: locale.value, id: props.campaign.id }))
  } else {
    payload.post(urlFor('supplier.ads.store', { locale: locale.value }))
  }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <BaseSection :title="t('ads.form.settings')" :description="t('ads.form.settingsHint')">
      <div class="grid gap-6 md:grid-cols-2">
        <BaseSelect
          v-if="!campaign"
          id="ad-product"
          v-model="form.productId"
          class="md:col-span-2"
          :label="t('ads.form.product')"
          :error="form.errors.productId"
          required
        >
          <option :value="null" disabled>{{ t('ads.form.productPlaceholder') }}</option>
          <option v-for="product in products ?? []" :key="product.id" :value="product.id">
            {{ product.name }}
          </option>
        </BaseSelect>

        <BaseInput
          id="ad-max-cpc"
          v-model="form.maxCpc"
          type="number"
          :label="t('ads.form.maxCpc')"
          :hint="
            t('ads.form.maxCpcHint', {
              min: money(AD_MIN_CPC_CENTS),
              max: money(AD_MAX_CPC_CENTS),
            })
          "
          :error="form.errors.maxCpc"
          :min="AD_MIN_CPC_CENTS / 100"
          :max="AD_MAX_CPC_CENTS / 100"
          step="0.01"
          required
        />
        <BaseInput
          id="ad-daily-budget"
          v-model="form.dailyBudget"
          type="number"
          :label="t('ads.form.dailyBudget')"
          :hint="t('ads.form.dailyBudgetHint')"
          :error="form.errors.dailyBudget"
          :min="AD_MIN_DAILY_BUDGET_CENTS / 100"
          step="0.01"
          required
        />
        <BaseInput
          id="ad-starts-on"
          v-model="form.startsOn"
          type="date"
          :label="t('ads.form.startsOn')"
          :error="form.errors.startsOn"
          required
        />
        <BaseInput
          id="ad-ends-on"
          v-model="form.endsOn"
          type="date"
          :label="t('ads.form.endsOn')"
          :hint="t('ads.form.endsOnHint')"
          :error="form.errors.endsOn"
        />
      </div>
    </BaseSection>

    <div class="flex items-center justify-end gap-3">
      <BaseLinkButton :href="indexUrl" variant="secondary">{{
        t('ads.form.cancel')
      }}</BaseLinkButton>
      <BaseButton type="submit" :loading="form.processing">
        {{ campaign ? t('ads.form.submitUpdate') : t('ads.form.submitCreate') }}
      </BaseButton>
    </div>
  </form>
</template>
