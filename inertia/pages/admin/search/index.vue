<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, router, usePoll } from '@inertiajs/vue3'
import { FlaskConical } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import SearchDrift from '~/components/admin/search/search_drift.vue'
import SearchReindexForm from '~/components/admin/search/search_reindex_form.vue'
import SearchRuns from '~/components/admin/search/search_runs.vue'
import SearchStatus from '~/components/admin/search/search_status.vue'
import BaseButton from '~/components/base/base_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminSearchDrift, AdminSearchOverview } from '#shared/types/admin_search'

const props = defineProps<{
  overview: AdminSearchOverview
  drift?: AdminSearchDrift | null
}>()

const { t, locale } = useI18n()
const sending = ref(false)

// Une opération en cours : l'écran se met à jour seul, sans recharger l'écart.
const { start, stop } = usePoll(2000, { only: ['overview'] }, { autoStart: false, keepAlive: true })
watch(
  () => props.overview.active,
  (active) => (active ? start() : stop()),
  { immediate: true }
)

const available = computed(() => props.overview.status.state === 'ready')
const busy = (kind: 'reindexRuns' | 'evaluationRuns') =>
  props.overview[kind].some((run) => run.status === 'pending' || run.status === 'running')

function evaluate() {
  router.post(
    urlFor('admin.search.evaluate', { locale: locale.value }),
    {},
    {
      preserveScroll: true,
      onStart: () => (sending.value = true),
      onFinish: () => (sending.value = false),
    }
  )
}
</script>

<template>
  <Head :title="t('admin.search.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.search.title')" :description="t('admin.search.subtitle')" />

    <SearchStatus :status="overview.status" />
    <SearchDrift :drift="drift" :available="available" />
    <SearchReindexForm :enabled="available" :busy="busy('reindexRuns')" />
    <SearchRuns kind="reindex" :runs="overview.reindexRuns" />

    <BaseSection
      :title="t('admin.search.evaluation.title')"
      :description="t('admin.search.evaluation.hint')"
    >
      <BaseButton :disabled="!available || busy('evaluationRuns') || sending" @click="evaluate">
        <FlaskConical :size="16" aria-hidden="true" />
        {{ t('admin.search.evaluation.submit') }}
      </BaseButton>
    </BaseSection>
    <SearchRuns kind="evaluation" :runs="overview.evaluationRuns" />
  </div>
</template>
