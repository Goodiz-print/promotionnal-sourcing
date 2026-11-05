<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AnnouncementForm from '~/components/admin/announcement/announcement_form.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { AnnouncementAudience } from '#shared/types/announcement'

defineProps<{ audienceSizes: Record<Exclude<AnnouncementAudience, 'organization'>, number> }>()

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('admin.announcements.createTitle')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('admin.announcements.createTitle')"
      :description="t('admin.announcements.createSubtitle')"
      :back-href="urlFor('admin.announcements.index', { locale })"
      :back-label="t('admin.announcements.back')"
    />

    <AnnouncementForm :audience-sizes="audienceSizes" />
  </div>
</template>
