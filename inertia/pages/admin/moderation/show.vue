<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import ModerationDecisionForm from '~/components/admin/moderation_decision_form.vue'
import ModerationStatusBadge from '~/components/admin/moderation_status_badge.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { AdminModerationDetail } from '#shared/types/admin_moderation'

defineProps<{ detail: AdminModerationDetail }>()

const { t, locale } = useI18n()

function formatDate(value: string): string {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <Head :title="detail.item.label" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="detail.item.label"
      :description="`${t(`admin.moderation.types.${detail.item.targetType}`)}${
        detail.item.subtitle ? ` · ${detail.item.subtitle}` : ''
      }`"
    >
      <template #actions>
        <BaseLinkButton
          :href="urlFor('admin.moderation.index', { locale })"
          variant="secondary"
          size="sm"
        >
          {{ t('admin.moderation.back') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <div class="grid gap-6 lg:grid-cols-2">
      <ModerationDecisionForm
        :target-type="detail.item.targetType"
        :target-id="detail.item.targetId"
      />

      <BaseCard padding="md">
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-heading-md text-text-primary">
              {{ t('admin.moderation.history.title') }}
            </h2>
            <ModerationStatusBadge :status="detail.item.status" />
          </div>

          <p v-if="detail.history.length === 0" class="text-body-sm text-text-secondary">
            {{ t('admin.moderation.history.empty') }}
          </p>

          <ol v-else class="flex flex-col gap-3">
            <li
              v-for="entry in detail.history"
              :key="entry.id"
              class="flex flex-col gap-1 border-b border-hairline pb-3 last:border-b-0 last:pb-0"
            >
              <div class="flex flex-wrap items-center gap-2">
                <ModerationStatusBadge :status="entry.status" />
                <span class="text-tabular text-caption text-text-secondary">
                  {{ formatDate(entry.decidedAt) }}
                </span>
                <span v-if="entry.decidedByEmail" class="text-caption text-text-secondary">
                  {{ t('admin.moderation.history.by', { email: entry.decidedByEmail }) }}
                </span>
              </div>
              <p v-if="entry.reason" class="text-body-sm text-text-primary">{{ entry.reason }}</p>
            </li>
          </ol>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
