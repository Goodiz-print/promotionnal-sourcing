<script setup lang="ts">
import { Link, Form } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'

defineProps<{ initials: string }>()

const { t, locale } = useI18n()
</script>

<template>
  <details class="relative">
    <summary
      :title="t('common.nav.userMenu')"
      :aria-label="t('common.nav.userMenu')"
      class="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-[var(--primary-3)] text-sm font-medium text-[var(--primary-11)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
    >
      {{ initials }}
    </summary>
    <div
      class="absolute right-0 z-20 mt-2 flex w-48 flex-col gap-1 rounded border border-[var(--gray-4)] bg-white p-2 shadow-lg"
    >
      <Link
        route="account.show"
        :params="{ locale }"
        class="rounded px-3 py-2 text-sm font-medium hover:bg-[var(--gray-2)]"
      >
        {{ t('common.nav.account') }}
      </Link>
      <Form route="session.destroy" :params="{ locale }">
        <button
          type="submit"
          class="w-full cursor-pointer rounded px-3 py-2 text-left text-sm font-medium hover:bg-[var(--gray-2)]"
        >
          {{ t('common.nav.logout') }}
        </button>
      </Form>
    </div>
  </details>
</template>
