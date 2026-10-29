<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import AuthHeader from '~/components/auth/auth_header.vue'
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
    <AuthHeader :title="t('auth.reset.title')" :description="t('auth.reset.subtitle')" />

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
