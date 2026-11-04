<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { BadgeCheck, Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { CertificationAdminType } from '#shared/types/certification'

defineProps<{ certifications: CertificationAdminType[] }>()

const { t, locale } = useI18n()

const createUrl = computed(() => urlFor('admin.certifications.create', { locale: locale.value }))

function destroy(certification: CertificationAdminType) {
  if (!window.confirm(t('certifications.confirmDelete'))) return
  router.delete(
    urlFor('admin.certifications.destroy', { locale: locale.value, id: certification.id }),
    { preserveScroll: true }
  )
}
</script>

<template>
  <Head :title="t('certifications.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('certifications.index.title')"
      :description="t('certifications.index.subtitle')"
    >
      <!-- Une seule action primaire par écran : l'état vide porte la sienne. -->
      <template v-if="certifications.length > 0" #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('certifications.newCertification') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseEmptyState
      v-if="certifications.length === 0"
      :title="t('certifications.index.empty')"
      :description="t('certifications.index.emptyDescription')"
      :icon="BadgeCheck"
    >
      <template #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('certifications.newCertification') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>

    <BaseTable v-else :caption="t('certifications.index.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('certifications.index.columns.name') }}</th>
          <th scope="col">{{ t('certifications.index.columns.slug') }}</th>
          <th scope="col">{{ t('certifications.index.columns.domain') }}</th>
          <th scope="col">{{ t('certifications.index.columns.isEco') }}</th>
          <th scope="col" class="text-right">{{ t('certifications.index.columns.products') }}</th>
          <th scope="col" class="text-right">
            <span class="sr-only">{{ t('certifications.index.columns.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="certification in certifications" :key="certification.id">
        <td>
          <Link
            route="admin.certifications.edit"
            :params="{ locale, id: certification.id }"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ certification.name ?? certification.slug }}
          </Link>
        </td>
        <td class="text-text-secondary">{{ certification.slug }}</td>
        <td>{{ t(`certifications.domains.${certification.domain}`) }}</td>
        <td>
          <BaseBadge :tone="certification.isEco ? 'success' : 'neutral'">
            {{ certification.isEco ? t('certifications.index.yes') : t('certifications.index.no') }}
          </BaseBadge>
        </td>
        <td class="text-tabular text-right">{{ certification.productsCount }}</td>
        <td>
          <div class="flex items-center justify-end gap-2">
            <BaseLinkButton
              :href="urlFor('admin.certifications.edit', { locale, id: certification.id })"
              size="sm"
              variant="secondary"
            >
              {{ t('certifications.edit') }}
            </BaseLinkButton>
            <BaseIconButton :label="t('certifications.delete')" @click="destroy(certification)">
              <Trash2 :size="18" aria-hidden="true" />
            </BaseIconButton>
          </div>
        </td>
      </tr>
    </BaseTable>
  </div>
</template>
