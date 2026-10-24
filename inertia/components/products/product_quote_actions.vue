<script setup lang="ts">
import { ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type { ProductRfqContextType } from '#shared/types/rfq'

/**
 * Demande de devis « en un clic » depuis une fiche produit.
 *
 * - acheteur connecté (`canCreateRfq`) : ouvre le formulaire de demande déjà
 *   rempli avec ce produit et son fournisseur, ou l'ajoute à un brouillon ;
 * - visiteur anonyme : renvoyé vers la connexion, qui le ramène ici ;
 * - connecté sans droit d'acheteur : rien (le bouton serait une impasse).
 */
const props = defineProps<{ productId: number; rfqContext: ProductRfqContextType }>()

const { t, locale } = useI18n()
const page = usePage()

const draftId = ref<number | null>(null)

function requestQuote() {
  router.get(urlFor('rfqs.create', { locale: locale.value }), { productId: props.productId })
}

function signIn() {
  const back = `${urlFor('rfqs.create', { locale: locale.value })}?productId=${props.productId}`
  router.get(urlFor('session.create', { locale: locale.value }), { redirect: back })
}

function addToDraft() {
  if (draftId.value === null) return
  router.post(
    urlFor('rfqs.items.from_product', { locale: locale.value, id: draftId.value }),
    { productId: props.productId },
    { preserveScroll: true }
  )
}
</script>

<template>
  <div v-if="rfqContext.canCreateRfq" class="flex flex-col gap-4">
    <div class="sm:w-56">
      <BaseButton @click="requestQuote()">{{ t('products.show.requestQuote') }}</BaseButton>
    </div>

    <div v-if="rfqContext.drafts.length > 0" class="flex items-end gap-2">
      <BaseSelect id="rfq-draft" v-model="draftId" :label="t('products.show.addToDraft')">
        <option :value="null">{{ t('products.show.chooseDraft') }}</option>
        <option v-for="draft in rfqContext.drafts" :key="draft.id" :value="draft.id">
          {{ draft.title }}
        </option>
      </BaseSelect>
      <BaseButton variant="secondary" :disabled="draftId === null" @click="addToDraft()">
        {{ t('rfq.product.add') }}
      </BaseButton>
    </div>
  </div>

  <div v-else-if="!page.props.user" class="sm:w-72">
    <BaseButton @click="signIn()">{{ t('products.show.signInToRequest') }}</BaseButton>
  </div>
</template>
