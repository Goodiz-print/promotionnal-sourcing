<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AdminNav from '~/components/admin/admin_nav.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import type { AdminOrganizationDetail } from '#shared/types/admin'

defineProps<{ organization: AdminOrganizationDetail }>()

const { t, locale } = useI18n()

const FIELDS = ['email', 'phone', 'website', 'siret', 'vatNumber', 'country'] as const
</script>

<template>
  <Head :title="organization.name" />

  <div class="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-12">
    <AdminNav current="organizations" />

    <Link
      route="admin.organizations.index"
      :params="{ locale }"
      class="text-sm text-[var(--color-primary)] hover:underline"
    >
      {{ t('admin.organizations.back') }}
    </Link>

    <div class="flex items-center gap-3">
      <h1 class="text-[28px] tracking-[-0.5px]">{{ organization.name }}</h1>
      <BaseBadge :tone="organization.archivedAt ? 'warning' : 'success'">
        {{
          t(
            organization.archivedAt
              ? 'admin.organizations.status.archived'
              : 'admin.organizations.status.active'
          )
        }}
      </BaseBadge>
    </div>

    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded border border-[var(--gray-4)] p-4">
        <dt class="text-sm text-[var(--gray-6)]">{{ t('admin.organizations.columns.type') }}</dt>
        <dd class="font-medium">
          {{ t(`admin.organizations.types.${organization.organizationType}`) }}
        </dd>
      </div>
      <div class="rounded border border-[var(--gray-4)] p-4">
        <dt class="text-sm text-[var(--gray-6)]">{{ t('admin.organizations.detail.products') }}</dt>
        <dd class="font-medium">{{ organization.productsCount }}</dd>
      </div>
      <div class="rounded border border-[var(--gray-4)] p-4">
        <dt class="text-sm text-[var(--gray-6)]">{{ t('admin.organizations.detail.rfqs') }}</dt>
        <dd class="font-medium">{{ organization.rfqsCount }}</dd>
      </div>
    </dl>

    <section>
      <h2 class="mb-3 text-lg font-medium">{{ t('admin.organizations.detail.contact') }}</h2>
      <dl class="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div v-for="field in FIELDS" :key="field" class="flex gap-2">
          <dt class="text-[var(--gray-6)]">{{ t(`admin.organizations.fields.${field}`) }}</dt>
          <dd>{{ organization[field] ?? '—' }}</dd>
        </div>
      </dl>
    </section>

    <section>
      <h2 class="mb-3 text-lg font-medium">
        {{ t('admin.organizations.detail.members', { count: organization.members.length }) }}
      </h2>
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-[var(--gray-4)] text-left text-[var(--gray-6)]">
            <th class="py-2 pr-4 font-medium">{{ t('admin.users.columns.name') }}</th>
            <th class="py-2 pr-4 font-medium">{{ t('admin.users.columns.email') }}</th>
            <th class="py-2 pr-4 font-medium">{{ t('admin.organizations.detail.role') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="member in organization.members"
            :key="member.id"
            class="border-b border-[var(--gray-3)]"
          >
            <td class="py-3 pr-4 font-medium">{{ member.fullName ?? '—' }}</td>
            <td class="py-3 pr-4 text-[var(--gray-6)]">{{ member.email }}</td>
            <td class="py-3 pr-4">{{ t(`admin.organizations.roles.${member.roleSlug}`) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
