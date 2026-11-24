<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, CreditCard } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import OrganizationSubscriptionActions from '~/components/admin/organization/organization_subscription_actions.vue'
import OrganizationSubscriptionForm from '~/components/admin/organization/organization_subscription_form.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { BadgeTone } from '~/types/ui'
import { dayInSubscriptionZone, lastCoveredDay } from '#shared/helpers/subscription'
import type { AdminOrganizationSubscription } from '#shared/types/admin_organization'
import type { SubscriptionStatus } from '#shared/types/subscription'

/**
 * Abonnement d'une organisation fournisseur (#214) : historique des périodes
 * (manuelles ou en ligne), actions sur l'abonnement manuel ouvert, et saisie
 * d'un nouvel abonnement quand aucun n'est ouvert.
 */
const props = defineProps<{
  organizationId: number
  subscriptions: AdminOrganizationSubscription[]
  canManage: boolean
}>()

const { t, locale } = useI18n()

const OPEN: SubscriptionStatus[] = ['scheduled', 'pending', 'active', 'past_due']
const TONES: Record<SubscriptionStatus, BadgeTone> = {
  scheduled: 'info',
  pending: 'warning',
  active: 'success',
  past_due: 'warning',
  expired: 'neutral',
  cancelled: 'neutral',
}

const hasOpen = computed(() => props.subscriptions.some((s) => OPEN.includes(s.status)))

const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale.value)

const period = (subscription: AdminOrganizationSubscription) => ({
  start: formatDay(dayInSubscriptionZone(new Date(subscription.startsAt))),
  end: subscription.endsAt ? formatDay(lastCoveredDay(subscription.endsAt)) : null,
})

/** Lignes du tableau avec leur période déjà formatée (une fois par ligne). */
const rows = computed(() =>
  props.subscriptions.map((subscription) => ({ subscription, period: period(subscription) }))
)
</script>

<template>
  <BaseSection :title="t('admin.organizations.subscription.title')" flush>
    <div v-if="subscriptions.length === 0" class="p-6">
      <BaseEmptyState
        :title="t('admin.organizations.subscription.empty')"
        :icon="CreditCard"
        compact
      />
    </div>

    <BaseTable v-else bare :caption="t('admin.organizations.subscription.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.organizations.subscription.fields.plan') }}</th>
          <th scope="col">{{ t('admin.organizations.subscription.fields.status') }}</th>
          <th scope="col">{{ t('admin.organizations.subscription.fields.period') }}</th>
          <th scope="col">{{ t('admin.organizations.subscription.fields.origin') }}</th>
          <th scope="col">{{ t('admin.organizations.subscription.fields.author') }}</th>
          <th v-if="canManage" scope="col">
            <span class="sr-only">{{ t('admin.organizations.detail.member.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="{ subscription, period: range } in rows" :key="subscription.id">
        <td class="font-semibold text-text-primary">
          {{ t(`subscription.plans.${subscription.plan}.name`) }}
        </td>
        <td>
          <BaseBadge dot :tone="TONES[subscription.status]">
            {{ t(`subscription.status.${subscription.status}`) }}
          </BaseBadge>
        </td>
        <td class="text-tabular whitespace-nowrap">
          <span class="inline-flex items-center gap-1">
            {{ range.start }}
            <template v-if="range.end">
              <ArrowRight :size="14" aria-hidden="true" />
              <span class="sr-only">{{ t('admin.organizations.subscription.periodUntil') }}</span>
              {{ range.end }}
            </template>
          </span>
        </td>
        <td>{{ t(`admin.organizations.subscription.origins.${subscription.origin}`) }}</td>
        <td class="text-text-secondary">
          {{ subscription.createdByEmail ?? t('admin.organizations.detail.notProvided') }}
        </td>
        <td v-if="canManage">
          <OrganizationSubscriptionActions
            v-if="subscription.editable"
            :organization-id="organizationId"
            :subscription="subscription"
          />
        </td>
      </tr>
    </BaseTable>

    <div v-if="canManage && !hasOpen" class="border-t border-hairline p-6">
      <OrganizationSubscriptionForm :organization-id="organizationId" />
    </div>
  </BaseSection>
</template>
