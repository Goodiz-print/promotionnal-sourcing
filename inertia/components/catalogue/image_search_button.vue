<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { Camera } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import { IMAGE_UPLOAD_EXTENSIONS } from '#shared/types/image_upload'

/**
 * Recherche par image : l'acheteur choisit une photo, elle est envoyée au
 * serveur qui la fait décrire par l'IA puis redirige vers le catalogue avec la
 * description comme terme de recherche. Rien n'est conservé côté serveur.
 */
const { t, locale } = useI18n()

const input = ref<HTMLInputElement | null>(null)
const form = useForm<{ image: File | null }>({ image: null })
const accept = IMAGE_UPLOAD_EXTENSIONS.map((extension) => `.${extension}`).join(',')

function onChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  form.image = file
  form.post(urlFor('products.image_search', { locale: locale.value }), {
    forceFormData: true,
    preserveScroll: true,
    // Repart d'un état neuf : la barre de filtres doit afficher le terme généré.
    preserveState: false,
    onFinish: () => {
      // Autorise le choix de la même photo juste après un échec.
      if (input.value) input.value.value = ''
      form.image = null
    },
  })
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <input
      ref="input"
      type="file"
      class="hidden"
      :accept="accept"
      :aria-label="t('products.imageSearch.button')"
      @change="onChange"
    />
    <BaseButton variant="secondary" block :loading="form.processing" @click="input?.click()">
      <template #icon><Camera :size="16" aria-hidden="true" /></template>
      {{ form.processing ? t('products.imageSearch.analysing') : t('products.imageSearch.button') }}
    </BaseButton>
    <p v-if="form.errors.image" role="alert" class="text-body-sm text-danger">
      {{ form.errors.image }}
    </p>
    <p v-else class="text-body-sm text-text-muted">
      {{ t('products.imageSearch.hint') }} {{ t('products.imageSearch.privacy') }}
    </p>
  </div>
</template>
