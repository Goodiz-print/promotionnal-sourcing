<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { ShieldCheck } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AgencyReviewFilters from '~/components/admin/agency_review_filters.vue'
import AgencyReviewStatusBadge from '~/components/admin/agency_review_status_badge.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminAgencyReviewFilters, AdminAgencyReviewItem } from '#shared/types/agency_review'
import type { Paginated } from '#shared/types/pagination'
import { formatShortDate } from '#shared/helpers/date'

const props = defineProps<{
  queue: Paginated<AdminAgencyReviewItem>
  filters: AdminAgencyReviewFilters
}>()

const { t, locale } = useI18n()

let current = { ...props.filters }

function visit(filters: AdminAgencyReviewFilters, page = 1) {
  current = filters
  router.get(
    urlFor('admin.agency_reviews.index', { locale: locale.value }),
    { status: filters.status, page },
    { preserveState: true, preserveScroll: true, only: ['queue', 'filters'] }
  )
}

const formatDate = (value: string) => formatShortDate(value, locale.value)

const showUrl = (item: AdminAgencyReviewItem) =>
  urlFor('admin.agency_reviews.show', { locale: locale.value, id: item.id })
</script>

<template>
  <Head :title="t('admin.agencyReviews.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.agencyReviews.title')"
      :description="t('admin.agencyReviews.subtitle')"
    />

    <AgencyReviewFilters :filters="filters" @change="visit" />

    <div class="flex flex-col gap-4">
      <p class="text-tabular text-body-sm text-text-secondary">
        {{ t('admin.agencyReviews.resultsCount', { count: queue.meta.total }) }}
      </p>

      <BaseEmptyState
        v-if="queue.data.length === 0"
        :title="t('admin.agencyReviews.empty')"
        :description="t('admin.agencyReviews.emptyDescription')"
        :icon="ShieldCheck"
      />

      <BaseTable v-else :caption="t('admin.agencyReviews.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.agencyReviews.columns.agency') }}</th>
            <th scope="col">{{ t('admin.agencyReviews.columns.reasons') }}</th>
            <th scope="col">{{ t('admin.agencyReviews.columns.vat') }}</th>
            <th scope="col">{{ t('admin.agencyReviews.columns.domain') }}</th>
            <th scope="col">{{ t('admin.agencyReviews.columns.submitted') }}</th>
            <th scope="col">{{ t('admin.agencyReviews.columns.status') }}</th>
            <th scope="col">
              <span class="sr-only">{{ t('admin.agencyReviews.review') }}</span>
            </th>
          </tr>
        </template>

        <tr v-for="item in queue.data" :key="item.id">
          <td class="font-semibold text-text-primary">
            {{ item.name }}
            <span class="block text-caption font-normal text-text-secondary">
              {{ item.country }}
            </span>
          </td>
          <td>
            <div class="flex flex-wrap gap-1">
              <BaseBadge v-for="reason in item.reasons" :key="reason" tone="warning">
                {{ t(`admin.agencyReviews.reasons.${reason}`) }}
              </BaseBadge>
            </div>
          </td>
          <td>
            <BaseBadge :tone="item.vatVerifiedAt ? 'success' : 'neutral'">
              {{
                t(
                  item.vatVerifiedAt
                    ? 'admin.agencyReviews.verified'
                    : 'admin.agencyReviews.notVerified'
                )
              }}
            </BaseBadge>
          </td>
          <td>
            <BaseBadge :tone="item.domainVerifiedAt ? 'success' : 'neutral'">
              {{
                t(
                  item.domainVerifiedAt
                    ? 'admin.agencyReviews.verified'
                    : 'admin.agencyReviews.notVerified'
                )
              }}
            </BaseBadge>
          </td>
          <td class="text-tabular whitespace-nowrap">{{ formatDate(item.submittedAt) }}</td>
          <td><AgencyReviewStatusBadge :status="item.status" /></td>
          <td class="text-right">
            <BaseLinkButton :href="showUrl(item)" variant="secondary" size="sm">
              {{ t('admin.agencyReviews.review') }}
            </BaseLinkButton>
          </td>
        </tr>
      </BaseTable>

      <BasePagination
        :meta="queue.meta"
        :previous-label="t('admin.pagination.previous')"
        :next-label="t('admin.pagination.next')"
        @change="(page) => visit(current, page)"
      />
    </div>
  </div>
</template>
