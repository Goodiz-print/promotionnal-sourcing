<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AiBackfillForm from '~/components/admin/ai/ai_backfill_form.vue'
import AiCoverage from '~/components/admin/ai/ai_coverage.vue'
import AiDailyVolume from '~/components/admin/ai/ai_daily_volume.vue'
import AiFailures from '~/components/admin/ai/ai_failures.vue'
import AiKpis from '~/components/admin/ai/ai_kpis.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import { BUTTON_BASE_CLASSES, BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES } from '~/types/ui'
import type { AdminAiOverview } from '#shared/types/admin_ai'
import type { TranslatableEntity } from '#shared/types/ai'

defineProps<{ overview: AdminAiOverview; entities: TranslatableEntity[] }>()

const { t, locale } = useI18n()

const linkClasses = [BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES.secondary, BUTTON_SIZE_CLASSES.md]
</script>

<template>
  <Head :title="t('admin.ai.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.ai.title')"
      :description="
        t('admin.ai.subtitle', { model: overview.model, version: overview.promptVersion })
      "
    >
      <template #actions>
        <Link :href="urlFor('admin.ai.translations', { locale })" :class="linkClasses">
          {{ t('admin.ai.reviewLink') }}
        </Link>
      </template>
    </BasePageHeader>

    <BaseAlert v-if="!overview.enabled" tone="warning">{{ t('admin.ai.disabled') }}</BaseAlert>

    <AiKpis :overview="overview" />
    <AiBackfillForm :entities="entities" :enabled="overview.enabled" />
    <AiCoverage :rows="overview.coverage" />
    <AiDailyVolume :rows="overview.daily" />
    <AiFailures :rows="overview.failures" />
  </div>
</template>
