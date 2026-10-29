<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { ExternalLink, PackageSearch } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseDescriptionItem from '~/components/base/base_description_item.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import ProductCard from '~/components/product_card.vue'
import DocumentList from '~/components/documents/document_list.vue'
import type { SupplierDetailType } from '#shared/types/supplier'
import type { OrganizationDocumentType } from '#shared/types/document'

const props = defineProps<{ supplier: SupplierDetailType }>()

const { t, locale } = useI18n()
const profile = props.supplier.supplierProfile

const directoryUrl = computed(() => urlFor('suppliers.index', { locale: locale.value }))

/** Coordonnées : seules les lignes renseignées sont affichées (`BaseDescriptionList`). */
const contactItems = computed(() => [
  { label: t('suppliers.show.country'), value: props.supplier.country },
  { label: t('suppliers.show.email'), value: props.supplier.email },
  { label: t('suppliers.show.phone'), value: props.supplier.phone },
])

/** Conditions commerciales du profil fournisseur. */
const profileItems = computed(() =>
  profile
    ? [
        {
          label: t('supplier.fields.deliveryScope'),
          value: profile.deliveryScope
            ? t(`supplier.deliveryScope.${profile.deliveryScope}`)
            : null,
        },
        { label: t('supplier.fields.minOrderQuantity'), value: profile.minOrderQuantity },
        { label: t('supplier.fields.deliveryDays'), value: profile.deliveryDays },
        { label: t('supplier.fields.responseTimeDays'), value: profile.responseTimeDays },
      ]
    : []
)

function documentLabel(document: OrganizationDocumentType) {
  return t(`documents.kinds.${document.kind}`)
}
</script>

<template>
  <Head :title="supplier.name ?? supplier.slug" />

  <div class="flex flex-col gap-8">
    <div class="flex items-start gap-4">
      <img
        v-if="supplier.logoUrl"
        :src="supplier.logoUrl"
        :alt="supplier.name ?? supplier.slug"
        class="size-16 shrink-0 rounded-xl border border-hairline bg-card object-contain"
      />
      <BasePageHeader
        class="min-w-0 flex-1"
        :title="supplier.name ?? supplier.slug"
        :description="supplier.description ?? ''"
        :back-href="directoryUrl"
        :back-label="t('suppliers.show.backToDirectory')"
      >
        <template #meta>
          <BaseBadge tone="neutral">{{ supplier.country }}</BaseBadge>
          <BaseBadge v-if="profile?.isFoundingPartner" tone="brand">
            {{ t('suppliers.show.foundingPartner') }}
          </BaseBadge>
        </template>
        <template v-if="supplier.website" #actions>
          <BaseLinkButton :href="supplier.website" variant="secondary">
            <ExternalLink :size="18" aria-hidden="true" />
            {{ t('suppliers.show.website') }}
          </BaseLinkButton>
        </template>
      </BasePageHeader>
    </div>

    <div class="grid items-start gap-8 lg:grid-cols-2">
      <BaseSection v-if="profile" :title="t('suppliers.show.profile')">
        <div class="flex flex-col gap-5">
          <BaseDescriptionList :items="profileItems">
            <BaseDescriptionItem
              v-if="profile.certifications && profile.certifications.length > 0"
              :label="t('supplier.fields.certifications')"
              full
            >
              <span class="flex flex-wrap gap-1.5">
                <BaseBadge v-for="cert in profile.certifications" :key="cert" tone="info">
                  {{ cert }}
                </BaseBadge>
              </span>
            </BaseDescriptionItem>
          </BaseDescriptionList>
          <p v-if="profile.bio" class="whitespace-pre-line text-body-sm text-text-secondary">
            {{ profile.bio }}
          </p>
        </div>
      </BaseSection>

      <BaseSection :title="t('suppliers.show.contact')">
        <BaseDescriptionList :items="contactItems">
          <BaseDescriptionItem v-if="supplier.website" :label="t('suppliers.show.websiteLabel')">
            <a
              :href="supplier.website"
              target="_blank"
              rel="noopener"
              class="font-semibold text-indigo-600 hover:underline"
            >
              {{ supplier.website }}
            </a>
          </BaseDescriptionItem>
        </BaseDescriptionList>
      </BaseSection>
    </div>

    <BaseSection v-if="supplier.documents.length > 0" :title="t('documents.title')">
      <DocumentList :documents="supplier.documents" :label-for="documentLabel" />
    </BaseSection>

    <BaseSection :title="t('suppliers.show.products')">
      <BaseEmptyState
        v-if="supplier.products.length === 0"
        compact
        :icon="PackageSearch"
        :title="t('suppliers.show.noProducts')"
      />
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          v-for="product in supplier.products"
          :key="product.id"
          route="products.show"
          :params="{ locale, slug: product.slug }"
          class="block rounded-xl"
        >
          <ProductCard :product="product" />
        </Link>
      </div>
    </BaseSection>
  </div>
</template>
