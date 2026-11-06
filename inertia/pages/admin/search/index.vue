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
import type {
  AdminSearchDrift,
  AdminSearchDriftFailure,
  AdminSearchRuns,
  AdminSearchStatus,
  AdminSearchSupplierOption,
} from '#shared/types/admin_search'

const props = defineProps<{
  status: AdminSearchStatus
  runs: AdminSearchRuns
  suppliers: AdminSearchSupplierOption[]
  drift?: AdminSearchDrift | AdminSearchDriftFailure
}>()

const { t, locale } = useI18n()
const sending = ref(false)

// Une opération en cours : seul l'historique est rafraîchi (le moteur n'est pas
// sondé toutes les 2 s pendant qu'il indexe). À la fin, un dernier rechargement
// remet à jour le statut (nombre de documents, tâches).
const { start, stop } = usePoll(2000, { only: ['runs'] }, { autoStart: false, keepAlive: true })
const running = computed(() => props.runs.busy.reindex || props.runs.busy.evaluation)
watch(
  running,
  (active, wasActive) => {
    if (active) start()
    else {
      stop()
      if (wasActive) router.reload({ only: ['status'] })
    }
  },
  { immediate: true }
)

const available = computed(() => props.status.state === 'ready')

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

    <SearchStatus :status="status" />
    <SearchDrift :drift="drift" :available="available" />
    <SearchReindexForm :enabled="available" :busy="runs.busy.reindex" :suppliers="suppliers" />
    <SearchRuns kind="reindex" :runs="runs.reindex" />

    <BaseSection
      :title="t('admin.search.evaluation.title')"
      :description="t('admin.search.evaluation.hint')"
    >
      <BaseButton :disabled="!available || runs.busy.evaluation || sending" @click="evaluate">
        <FlaskConical :size="16" aria-hidden="true" />
        {{ t('admin.search.evaluation.submit') }}
      </BaseButton>
    </BaseSection>
    <SearchRuns kind="evaluation" :runs="runs.evaluation" />
  </div>
</template>
