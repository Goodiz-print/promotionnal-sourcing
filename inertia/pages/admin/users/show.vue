<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import UserActions from '~/components/admin/user_actions.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminUserDetail } from '#shared/types/admin_user'

const props = defineProps<{ account: AdminUserDetail; canManageRoles: boolean }>()

const { t, locale } = useI18n()

const formatDate = (value: string) => new Date(value).toLocaleDateString(locale.value)

const identity = computed(() => [
  { label: t('admin.users.columns.email'), value: props.account.email },
  { label: t('admin.users.show.firstName'), value: props.account.firstName },
  { label: t('admin.users.show.lastName'), value: props.account.lastName },
  {
    label: t('admin.users.show.civility'),
    value: props.account.civility
      ? t(`admin.users.show.civilityValues.${props.account.civility}`)
      : null,
  },
  { label: t('admin.users.show.locale'), value: props.account.locale },
  { label: t('admin.users.columns.createdAt'), value: formatDate(props.account.createdAt) },
  {
    label: t('admin.users.show.lastLogin'),
    value: props.account.lastLoginAt
      ? formatDate(props.account.lastLoginAt)
      : t('admin.users.show.never'),
  },
])
</script>

<template>
  <Head :title="account.fullName || account.email" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="account.fullName || account.email"
      :description="account.fullName ? account.email : ''"
      :back-href="urlFor('admin.users.index', { locale })"
      :back-label="t('admin.users.show.back')"
    >
      <template #meta>
        <BaseBadge v-if="account.suspendedAt" dot tone="danger">
          {{ t('admin.users.show.suspended') }}
        </BaseBadge>
        <BaseBadge v-if="!account.emailVerified" dot tone="warning">
          {{ t('admin.users.unverified') }}
        </BaseBadge>
        <BaseBadge v-if="account.platformRole !== 'none'" dot tone="brand">
          {{ t(`admin.users.roles.${account.platformRole}`) }}
        </BaseBadge>
      </template>
    </BasePageHeader>

    <BaseSection :title="t('admin.users.show.identity')">
      <BaseDescriptionList :items="identity" />
    </BaseSection>

    <BaseSection :title="t('admin.users.show.actions')">
      <UserActions :user="account" />
    </BaseSection>

    <BaseSection :title="t('admin.users.show.organizations')" flush>
      <p v-if="account.organizations.length === 0" class="p-6 text-body-sm text-text-secondary">
        {{ t('admin.users.show.noOrganizations') }}
      </p>
      <BaseTable v-else bare :caption="t('admin.users.show.organizations')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.users.columns.name') }}</th>
            <th scope="col">{{ t('admin.users.show.orgType') }}</th>
            <th scope="col">{{ t('admin.users.show.orgRole') }}</th>
            <th scope="col">{{ t('admin.users.columns.status') }}</th>
          </tr>
        </template>
        <tr v-for="org in account.organizations" :key="org.id">
          <td class="font-semibold text-text-primary">{{ org.name }}</td>
          <td>{{ t(`admin.organizations.types.${org.organizationType}`) }}</td>
          <td>{{ t(`admin.organizations.roles.${org.roleSlug}`) }}</td>
          <td>
            <BaseBadge v-if="org.archivedAt" tone="neutral">
              {{ t('admin.users.show.archivedOrg') }}
            </BaseBadge>
          </td>
        </tr>
      </BaseTable>
    </BaseSection>

    <BaseSection :title="t('admin.users.show.passkeys')" flush>
      <p v-if="account.passkeys.length === 0" class="p-6 text-body-sm text-text-secondary">
        {{ t('admin.users.show.noPasskeys') }}
      </p>
      <BaseTable v-else bare :caption="t('admin.users.show.passkeys')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.users.show.passkeyName') }}</th>
            <th scope="col">{{ t('admin.users.show.passkeyCreatedAt') }}</th>
            <th scope="col">{{ t('admin.users.show.passkeyLastUsedAt') }}</th>
          </tr>
        </template>
        <tr v-for="passkey in account.passkeys" :key="passkey.id">
          <td class="font-semibold text-text-primary">{{ passkey.name }}</td>
          <td class="text-tabular whitespace-nowrap">{{ formatDate(passkey.createdAt) }}</td>
          <td class="text-tabular whitespace-nowrap">
            {{ passkey.lastUsedAt ? formatDate(passkey.lastUsedAt) : t('admin.users.show.never') }}
          </td>
        </tr>
      </BaseTable>
    </BaseSection>

    <BaseSection :title="t('admin.users.show.consents')" flush>
      <p v-if="account.consents.length === 0" class="p-6 text-body-sm text-text-secondary">
        {{ t('admin.users.show.noConsents') }}
      </p>
      <BaseTable v-else bare :caption="t('admin.users.show.consents')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.users.show.consentKind') }}</th>
            <th scope="col">{{ t('admin.users.show.consentVersion') }}</th>
            <th scope="col">{{ t('admin.users.show.consentAcceptedAt') }}</th>
            <th scope="col">{{ t('admin.users.show.consentOrganization') }}</th>
          </tr>
        </template>
        <tr v-for="consent in account.consents" :key="consent.id">
          <td class="font-semibold text-text-primary">{{ consent.kind }}</td>
          <td>{{ consent.version }}</td>
          <td class="text-tabular whitespace-nowrap">{{ formatDate(consent.acceptedAt) }}</td>
          <td>{{ consent.organizationName }}</td>
        </tr>
      </BaseTable>
    </BaseSection>
  </div>
</template>
