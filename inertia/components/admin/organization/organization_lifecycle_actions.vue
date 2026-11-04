<script setup lang="ts">
import { Archive, ArchiveRestore } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useAdminOrganizationActions } from '~/composables/use_admin_organization_actions'
import BaseButton from '~/components/base/base_button.vue'
import { ICON_SIZE } from '~/types/ui'

/**
 * Archivage / restauration d'une organisation. Un seul bouton selon l'état ; la
 * confirmation est obligatoire et le bouton est désactivé pendant la requête.
 */
const props = defineProps<{ organizationId: number; archived: boolean }>()

const { t } = useI18n()
const { processing, archive, restore } = useAdminOrganizationActions(props.organizationId)
</script>

<template>
  <div class="flex flex-col items-start gap-3">
    <p class="text-body-sm text-text-secondary">
      {{
        archived
          ? t('admin.organizations.detail.lifecycle.archivedHint')
          : t('admin.organizations.detail.lifecycle.activeHint')
      }}
    </p>
    <BaseButton
      v-if="archived"
      variant="secondary"
      :disabled="processing"
      @click="restore(t('admin.organizations.actions.restore.confirm'))"
    >
      <template #icon><ArchiveRestore :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('admin.organizations.actions.restore.label') }}
    </BaseButton>
    <BaseButton
      v-else
      variant="danger"
      :disabled="processing"
      @click="archive(t('admin.organizations.actions.archive.confirm'))"
    >
      <template #icon><Archive :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('admin.organizations.actions.archive.label') }}
    </BaseButton>
  </div>
</template>
