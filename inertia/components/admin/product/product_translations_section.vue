<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { CONTENT_LOCALES, CONTENT_LOCALE_LABELS } from '#shared/types/i18n'
import type { AdminProductTranslation } from '#shared/types/admin_product'

/** Présence ou absence du nom et de la description pour chaque langue de contenu. */
const props = defineProps<{ translations: AdminProductTranslation[] }>()

const { t } = useI18n()

const rows = computed(() =>
  CONTENT_LOCALES.map((code) => {
    const found = props.translations.find((translation) => translation.locale === code)
    return {
      code,
      label: CONTENT_LOCALE_LABELS[code],
      name: found?.name ?? null,
      hasDescription: found?.hasDescription ?? false,
    }
  })
)
</script>

<template>
  <BaseSection :title="t('admin.products.detail.translations')" flush>
    <BaseTable bare :caption="t('admin.products.detail.translations')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.products.detail.locale') }}</th>
          <th scope="col">{{ t('admin.products.columns.name') }}</th>
          <th scope="col">{{ t('admin.products.detail.description') }}</th>
        </tr>
      </template>
      <tr v-for="row in rows" :key="row.code" :data-locale="row.code">
        <td class="font-semibold">{{ row.label }}</td>
        <td>
          <template v-if="row.name">{{ row.name }}</template>
          <BaseBadge v-else tone="warning">{{ t('admin.products.detail.missing') }}</BaseBadge>
        </td>
        <td>
          <BaseBadge :tone="row.hasDescription ? 'success' : 'warning'">
            {{
              t(
                row.hasDescription
                  ? 'admin.products.detail.present'
                  : 'admin.products.detail.missing'
              )
            }}
          </BaseBadge>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
