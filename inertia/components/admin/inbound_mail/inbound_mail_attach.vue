<script setup lang="ts">
import { ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { Link2, Search } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useInboundMailActions } from '~/composables/use_inbound_mail_actions'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseButton from '~/components/base/base_button.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminInboundMailRecipient } from '#shared/types/admin_inbound_mail'

/**
 * Rattachement manuel d'un mail (#227) : couples demande / fournisseur proposés
 * (fournisseurs du domaine de l'expéditeur), ou ceux d'une demande cherchée par
 * son numéro.
 */
const props = defineProps<{
  mailId: number
  candidates: AdminInboundMailRecipient[]
  rfqSearch: number | null
}>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()
const { attach } = useInboundMailActions()

const rfq = ref<number | null>(props.rfqSearch)
watch(
  () => props.rfqSearch,
  (value) => (rfq.value = value)
)

function search() {
  router.get(
    urlFor('admin.inbound_mail.show', { locale: locale.value, id: props.mailId }),
    rfq.value ? { rfq: rfq.value } : {},
    { preserveState: true, preserveScroll: true, only: ['candidates', 'rfqSearch'] }
  )
}
</script>

<template>
  <BaseSection
    :title="t('admin.inboundMail.attach.title')"
    :description="t('admin.inboundMail.attach.description')"
  >
    <div class="flex flex-col gap-4">
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="search">
        <BaseInput
          id="inbound-mail-rfq"
          v-model="rfq"
          type="number"
          :min="1"
          :label="t('admin.inboundMail.attach.rfqLabel')"
          :hint="t('admin.inboundMail.attach.rfqHint')"
        />
        <BaseButton type="submit" variant="secondary" size="sm">
          <Search :size="16" aria-hidden="true" />
          {{ t('admin.inboundMail.attach.search') }}
        </BaseButton>
      </form>

      <BaseEmptyState
        v-if="props.candidates.length === 0"
        compact
        :title="t('admin.inboundMail.attach.empty')"
        :description="t('admin.inboundMail.attach.emptyDescription')"
        :icon="Link2"
      />
      <BaseTable v-else :caption="t('admin.inboundMail.attach.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.inboundMail.attach.columns.rfq') }}</th>
            <th scope="col">{{ t('admin.inboundMail.attach.columns.supplier') }}</th>
            <th scope="col">{{ t('admin.inboundMail.attach.columns.sentAt') }}</th>
            <th scope="col">
              <span class="sr-only">{{ t('admin.inboundMail.columns.actions') }}</span>
            </th>
          </tr>
        </template>
        <tr v-for="candidate in props.candidates" :key="candidate.rfqSupplierId">
          <td>
            <span class="text-tabular text-text-secondary">#{{ candidate.rfqId }}</span>
            {{ candidate.rfqTitle }}
          </td>
          <td>{{ candidate.supplierName }}</td>
          <td>{{ dateTime(candidate.sentAt) }}</td>
          <td class="text-right">
            <BaseButton size="sm" @click="attach(props.mailId, candidate.rfqSupplierId)">
              <Link2 :size="16" aria-hidden="true" />
              {{ t('admin.inboundMail.actions.attach') }}
            </BaseButton>
          </td>
        </tr>
      </BaseTable>
    </div>
  </BaseSection>
</template>
