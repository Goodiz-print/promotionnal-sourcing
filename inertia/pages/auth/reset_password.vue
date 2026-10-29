<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import AuthLayout from '~/layouts/auth.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseButton from '~/components/base/base_button.vue'

const props = defineProps<{ actionUrl: string }>()

defineOptions({ layout: AuthLayout })

const { t } = useI18n()

const form = useForm({ password: '', passwordConfirmation: '' })

function submit() {
  // URL signée reçue du serveur, telle quelle : la reconstruire perdrait la signature.
  form.post(props.actionUrl)
}
</script>

<template>
  <Head :title="t('auth.reset.title')" />

  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-2">
      <h1 class="text-display-md">{{ t('auth.reset.title') }}</h1>
      <p class="text-body-md text-text-secondary">
        {{ t('auth.reset.subtitle') }}
      </p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseInput
        id="password"
        v-model="form.password"
        type="password"
        autocomplete="new-password"
        :label="t('auth.fields.password')"
        :error="form.errors.password"
      />
      <BaseInput
        id="passwordConfirmation"
        v-model="form.passwordConfirmation"
        type="password"
        autocomplete="new-password"
        :label="t('auth.fields.passwordConfirmation')"
        :error="form.errors.passwordConfirmation"
      />
      <BaseButton type="submit" block :loading="form.processing">
        {{ t('auth.reset.submit') }}
      </BaseButton>
    </form>
  </div>
</template>
