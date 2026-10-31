<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseSelect from '~/components/base/base_select.vue'
import { PLATFORM_ROLES, type PlatformRole } from '#shared/types/user'

/**
 * Sélecteur du rôle plateforme d'un compte (écran Utilisateurs). Le changement
 * part immédiatement en `PATCH` ; le serveur re-vérifie le droit `roles.manage`
 * et trace l'opération dans le journal d'audit.
 */
const props = defineProps<{
  userId: number
  platformRole: PlatformRole
}>()

const { t, locale } = useI18n()

function change(value: PlatformRole) {
  router.patch(
    urlFor('admin.users.platform_role.update', { locale: locale.value, id: props.userId }),
    { platformRole: value },
    { preserveScroll: true }
  )
}
</script>

<template>
  <BaseSelect
    :id="`platform-role-${userId}`"
    :model-value="platformRole"
    :aria-label="t('admin.users.roles.label')"
    @update:model-value="change"
  >
    <option v-for="role in PLATFORM_ROLES" :key="role" :value="role">
      {{ t(`admin.users.roles.${role}`) }}
    </option>
  </BaseSelect>
</template>
