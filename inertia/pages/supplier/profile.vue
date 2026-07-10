<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { DELIVERY_SCOPES, type SupplierProfileType } from '#shared/types/organization'

const props = defineProps<{
  profile: SupplierProfileType | null
}>()

const { t, locale } = useI18n()

const form = useForm({
  minOrderQuantity: props.profile?.minOrderQuantity ?? null,
  deliveryDays: props.profile?.deliveryDays ?? null,
  deliveryScope: props.profile?.deliveryScope ?? null,
  certifications: props.profile?.certifications ? [...props.profile.certifications] : [],
  bio: props.profile?.bio ?? '',
  responseTimeDays: props.profile?.responseTimeDays ?? null,
})

function emptyToNull(value: number | string | null): number | null {
  return value === '' || value === null ? null : Number(value)
}

function addCertification() {
  form.certifications.push('')
}

function removeCertification(index: number) {
  form.certifications.splice(index, 1)
}

function submit() {
  form
    .transform((data) => ({
      ...data,
      minOrderQuantity: emptyToNull(data.minOrderQuantity),
      deliveryDays: emptyToNull(data.deliveryDays),
      responseTimeDays: emptyToNull(data.responseTimeDays),
      deliveryScope: data.deliveryScope || null,
      bio: data.bio.trim() ? data.bio.trim() : null,
      certifications: data.certifications.map((c) => c.trim()).filter((c) => c !== ''),
    }))
    .patch(urlFor('supplier.profile.update', { locale: locale.value }), { preserveScroll: true })
}

const inputClass =
  'h-10 w-full rounded border border-[var(--gray-4)] px-4 data-[invalid=true]:border-[#fb2c36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]'
</script>

<template>
  <Head :title="t('supplier.profile.title')" />

  <div class="mx-auto flex max-w-[600px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('supplier.profile.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">{{ t('supplier.profile.subtitle') }}</p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label for="minOrderQuantity" class="mb-1 block text-sm font-medium">
            {{ t('supplier.fields.minOrderQuantity') }}
          </label>
          <input
            id="minOrderQuantity"
            v-model="form.minOrderQuantity"
            type="number"
            min="0"
            :data-invalid="form.errors.minOrderQuantity ? 'true' : undefined"
            :class="inputClass"
          />
          <div
            v-if="form.errors.minOrderQuantity"
            class="mt-0.5 text-sm font-medium text-[#fb2c36]"
          >
            {{ form.errors.minOrderQuantity }}
          </div>
        </div>

        <div>
          <label for="deliveryDays" class="mb-1 block text-sm font-medium">
            {{ t('supplier.fields.deliveryDays') }}
          </label>
          <input
            id="deliveryDays"
            v-model="form.deliveryDays"
            type="number"
            min="0"
            :data-invalid="form.errors.deliveryDays ? 'true' : undefined"
            :class="inputClass"
          />
          <div v-if="form.errors.deliveryDays" class="mt-0.5 text-sm font-medium text-[#fb2c36]">
            {{ form.errors.deliveryDays }}
          </div>
        </div>

        <div>
          <label for="responseTimeDays" class="mb-1 block text-sm font-medium">
            {{ t('supplier.fields.responseTimeDays') }}
          </label>
          <input
            id="responseTimeDays"
            v-model="form.responseTimeDays"
            type="number"
            min="0"
            :data-invalid="form.errors.responseTimeDays ? 'true' : undefined"
            :class="inputClass"
          />
          <div
            v-if="form.errors.responseTimeDays"
            class="mt-0.5 text-sm font-medium text-[#fb2c36]"
          >
            {{ form.errors.responseTimeDays }}
          </div>
        </div>

        <div>
          <label for="deliveryScope" class="mb-1 block text-sm font-medium">
            {{ t('supplier.fields.deliveryScope') }}
          </label>
          <select
            id="deliveryScope"
            v-model="form.deliveryScope"
            :data-invalid="form.errors.deliveryScope ? 'true' : undefined"
            :class="inputClass"
          >
            <option :value="null">{{ t('supplier.deliveryScope.none') }}</option>
            <option v-for="scope in DELIVERY_SCOPES" :key="scope" :value="scope">
              {{ t(`supplier.deliveryScope.${scope}`) }}
            </option>
          </select>
          <div v-if="form.errors.deliveryScope" class="mt-0.5 text-sm font-medium text-[#fb2c36]">
            {{ form.errors.deliveryScope }}
          </div>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium">{{
          t('supplier.fields.certifications')
        }}</label>
        <div class="flex flex-col gap-2">
          <div v-for="(_, index) in form.certifications" :key="index" class="flex gap-2">
            <input
              v-model="form.certifications[index]"
              type="text"
              :placeholder="t('supplier.fields.certificationPlaceholder')"
              :class="inputClass"
            />
            <button
              type="button"
              class="shrink-0 cursor-pointer rounded border border-[var(--gray-4)] px-3 text-sm font-medium hover:bg-[var(--gray-2)]"
              @click="removeCertification(index)"
            >
              {{ t('supplier.fields.certificationRemove') }}
            </button>
          </div>
        </div>
        <button
          type="button"
          class="mt-2 cursor-pointer text-sm font-medium text-[var(--color-primary)] hover:underline"
          @click="addCertification"
        >
          {{ t('supplier.fields.certificationAdd') }}
        </button>
      </div>

      <div>
        <label for="bio" class="mb-1 block text-sm font-medium">{{
          t('supplier.fields.bio')
        }}</label>
        <textarea
          id="bio"
          v-model="form.bio"
          rows="4"
          :data-invalid="form.errors.bio ? 'true' : undefined"
          class="w-full rounded border border-[var(--gray-4)] px-4 py-2 data-[invalid=true]:border-[#fb2c36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
        />
        <div v-if="form.errors.bio" class="mt-0.5 text-sm font-medium text-[#fb2c36]">
          {{ form.errors.bio }}
        </div>
      </div>

      <div>
        <button
          type="submit"
          :disabled="form.processing"
          class="w-full cursor-pointer rounded bg-[var(--color-primary)] p-2.5 font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
        >
          {{ t('supplier.profile.submit') }}
        </button>
      </div>
    </form>
  </div>
</template>
