<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base_input.vue'
import BaseButton from '~/components/base_button.vue'

const props = defineProps<{ actionUrl: string }>()

const { t } = useI18n()

const form = useForm({ password: '', passwordConfirmation: '' })

function submit() {
  // URL signée reçue du serveur, telle quelle : la reconstruire perdrait la signature.
  form.post(props.actionUrl)
}
</script>

<template>
  <div class="mx-auto flex max-w-[400px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('auth.reset.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">
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
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('auth.reset.submit') }}
      </BaseButton>
    </form>
  </div>
</template>
