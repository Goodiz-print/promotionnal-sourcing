<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AgencyReviewDecisionForm from '~/components/admin/agency_review_decision_form.vue'
import AgencyReviewStatusBadge from '~/components/admin/agency_review_status_badge.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { AdminAgencyReviewDetail } from '#shared/types/agency_review'

const props = defineProps<{ detail: AdminAgencyReviewDetail }>()

const { t, locale } = useI18n()

const formatDate = (value: string) => new Date(value).toLocaleString(locale.value)

/** Champs d'identité affichés ; une valeur absente s'affiche « — ». */
const fields = [
  ['email', props.detail.item.email],
  ['phone', props.detail.phone],
  ['website', props.detail.item.website],
  ['siret', props.detail.siret],
  ['vatNumber', props.detail.vatNumber],
  ['activity', props.detail.activity],
] as const
</script>

<template>
  <Head :title="detail.item.name" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="detail.item.name"
      :description="
        t('admin.agencyReviews.submittedOn', { date: formatDate(detail.item.submittedAt) })
      "
    >
      <template #actions>
        <BaseLinkButton
          :href="urlFor('admin.agency_reviews.index', { locale })"
          variant="secondary"
          size="sm"
        >
          {{ t('admin.agencyReviews.back') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <div class="grid gap-6 lg:grid-cols-2">
      <BaseCard padding="md">
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-heading-md text-text-primary">
              {{ t('admin.agencyReviews.detail.title') }}
            </h2>
            <AgencyReviewStatusBadge :status="detail.item.status" />
          </div>

          <dl class="grid gap-3 sm:grid-cols-2">
            <div v-for="[key, value] in fields" :key="key" class="flex flex-col gap-0.5">
              <dt class="text-caption font-semibold text-text-muted">
                {{ t(`admin.agencyReviews.detail.${key}`) }}
              </dt>
              <dd class="text-body-sm break-words text-text-primary">{{ value ?? '—' }}</dd>
            </div>
          </dl>

          <div class="flex flex-col gap-2">
            <h3 class="text-caption font-semibold text-text-muted">
              {{ t('admin.agencyReviews.detail.checks') }}
            </h3>
            <div class="flex flex-wrap gap-2">
              <BaseBadge :tone="detail.item.vatVerifiedAt ? 'success' : 'neutral'">
                {{ t('admin.agencyReviews.columns.vat') }} :
                {{
                  t(
                    detail.item.vatVerifiedAt
                      ? 'admin.agencyReviews.verified'
                      : 'admin.agencyReviews.notVerified'
                  )
                }}
              </BaseBadge>
              <BaseBadge :tone="detail.item.domainVerifiedAt ? 'success' : 'neutral'">
                {{ t('admin.agencyReviews.columns.domain') }} :
                {{
                  t(
                    detail.item.domainVerifiedAt
                      ? 'admin.agencyReviews.verified'
                      : 'admin.agencyReviews.notVerified'
                  )
                }}
              </BaseBadge>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <h3 class="text-caption font-semibold text-text-muted">
              {{ t('admin.agencyReviews.columns.reasons') }}
            </h3>
            <ul class="flex flex-wrap gap-2">
              <li v-for="reason in detail.item.reasons" :key="reason">
                <BaseBadge tone="warning">
                  {{ t(`admin.agencyReviews.reasons.${reason}`) }}
                </BaseBadge>
              </li>
              <li v-if="detail.item.reasons.length === 0" class="text-body-sm text-text-secondary">
                {{ t('admin.agencyReviews.noReasons') }}
              </li>
            </ul>
          </div>

          <div class="flex flex-col gap-1">
            <h3 class="text-caption font-semibold text-text-muted">
              {{ t('admin.agencyReviews.detail.owners') }}
            </h3>
            <p v-for="owner in detail.owners" :key="owner.email" class="text-body-sm">
              {{ owner.fullName ?? owner.email }}
              <span v-if="owner.fullName" class="text-text-secondary">· {{ owner.email }}</span>
            </p>
          </div>
        </div>
      </BaseCard>

      <div class="flex flex-col gap-6">
        <AgencyReviewDecisionForm v-if="detail.canDecide" :organization-id="detail.item.id" />
        <BaseCard v-else padding="md">
          <p class="text-body-sm text-text-secondary">{{ t('admin.agencyReviews.closed') }}</p>
        </BaseCard>

        <BaseCard padding="md">
          <div class="flex flex-col gap-4">
            <h2 class="text-heading-md text-text-primary">
              {{ t('admin.agencyReviews.history.title') }}
            </h2>

            <p v-if="detail.history.length === 0" class="text-body-sm text-text-secondary">
              {{ t('admin.agencyReviews.history.empty') }}
            </p>

            <ol v-else class="flex flex-col gap-3">
              <li
                v-for="entry in detail.history"
                :key="entry.id"
                class="flex flex-col gap-1 border-b border-hairline pb-3 last:border-b-0 last:pb-0"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <AgencyReviewStatusBadge :status="entry.decision" />
                  <span class="text-tabular text-caption text-text-secondary">
                    {{ formatDate(entry.decidedAt) }}
                  </span>
                  <span v-if="entry.decidedByEmail" class="text-caption text-text-secondary">
                    {{ t('admin.agencyReviews.history.by', { email: entry.decidedByEmail }) }}
                  </span>
                </div>
                <p v-if="entry.reason" class="text-body-sm text-text-primary">{{ entry.reason }}</p>
              </li>
            </ol>
          </div>
        </BaseCard>
      </div>
    </div>
  </div>
</template>
