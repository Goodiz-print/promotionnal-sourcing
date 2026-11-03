<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type { TradeFilterValues } from '~/components/admin/types'

/**
 * Bloc de filtres commun aux listes de supervision : statut, (attention), acheteur,
 * fournisseur et période. Les champs sont envoyés à la validation du formulaire
 * (pas à chaque frappe) via `change` ; la page relance la visite Inertia.
 */
const props = defineProps<{
  filters: Partial<TradeFilterValues>
  statuses: readonly string[]
  /** Préfixe des libellés de statut (`rfq.status`, `quote.status`, `order.status`). */
  statusPrefix: string
  attentions?: readonly string[]
}>()
const emit = defineEmits<{ change: [filters: TradeFilterValues] }>()

const { t } = useI18n()

const model = reactive({
  status: props.filters.status ?? '',
  attention: props.filters.attention ?? '',
  buyer: props.filters.buyer ?? '',
  supplier: props.filters.supplier ?? '',
  from: props.filters.from ?? '',
  to: props.filters.to ?? '',
})

function submit() {
  emit('change', {
    status: model.status || null,
    attention: model.attention || null,
    buyer: model.buyer.trim() || null,
    supplier: model.supplier.trim() || null,
    from: model.from || null,
    to: model.to || null,
  })
}

function reset() {
  Object.assign(model, { status: '', attention: '', buyer: '', supplier: '', from: '', to: '' })
  submit()
}
</script>

<template>
  <BaseCard padding="md">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BaseSelect
          id="trade-status"
          v-model="model.status"
          :label="t('admin.trade.filters.status')"
        >
          <option value="">{{ t('admin.trade.filters.all') }}</option>
          <option v-for="status in statuses" :key="status" :value="status">
            {{ t(`${statusPrefix}.${status}`) }}
          </option>
        </BaseSelect>
        <BaseSelect
          v-if="attentions"
          id="trade-attention"
          v-model="model.attention"
          :label="t('admin.trade.filters.attention')"
        >
          <option value="">{{ t('admin.trade.filters.all') }}</option>
          <option v-for="flag in attentions" :key="flag" :value="flag">
            {{ t(`admin.rfqs.attention.${flag}`) }}
          </option>
        </BaseSelect>
        <BaseInput id="trade-buyer" v-model="model.buyer" :label="t('admin.trade.filters.buyer')" />
        <BaseInput
          id="trade-supplier"
          v-model="model.supplier"
          :label="t('admin.trade.filters.supplier')"
        />
        <BaseInput
          id="trade-from"
          v-model="model.from"
          type="date"
          :label="t('admin.trade.filters.from')"
        />
        <BaseInput
          id="trade-to"
          v-model="model.to"
          type="date"
          :label="t('admin.trade.filters.to')"
        />
      </div>
      <div class="flex justify-end gap-3">
        <BaseButton variant="secondary" size="sm" @click="reset">
          {{ t('admin.trade.filters.reset') }}
        </BaseButton>
        <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
