<script setup lang="ts">
import { Form } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'

const { locale } = useI18n()
</script>

<template>
  <div class="mx-auto flex max-w-[400px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('auth.login.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">
        {{ t('auth.login.subtitle') }}
      </p>
    </div>

    <div>
      <Form
        v-slot="{ processing, errors }"
        route="session.store"
        :params="{ locale }"
        class="flex flex-col gap-6"
      >
        <div>
          <label for="email" class="mb-1 block text-sm font-medium">{{
            t('auth.fields.email')
          }}</label>
          <input
            id="email"
            type="email"
            name="email"
            autocomplete="username"
            :data-invalid="errors.email ? 'true' : undefined"
            class="h-10 w-full rounded border border-[var(--gray-4)] px-4 data-[invalid=true]:border-[#fb2c36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
          />
          <div v-if="errors.email" class="mt-0.5 text-sm font-medium text-[#fb2c36]">
            {{ errors.email }}
          </div>
        </div>

        <div>
          <label for="password" class="mb-1 block text-sm font-medium">{{
            t('auth.fields.password')
          }}</label>
          <input
            id="password"
            type="password"
            name="password"
            autocomplete="current-password"
            :data-invalid="errors.password ? 'true' : undefined"
            class="h-10 w-full rounded border border-[var(--gray-4)] px-4 data-[invalid=true]:border-[#fb2c36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
          />
          <div v-if="errors.password" class="mt-0.5 text-sm font-medium text-[#fb2c36]">
            {{ errors.password }}
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="processing"
            class="w-full cursor-pointer rounded bg-[var(--color-primary)] p-2.5 font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
          >
            {{ t('auth.login.submit') }}
          </button>
        </div>
      </Form>
    </div>
  </div>
</template>
