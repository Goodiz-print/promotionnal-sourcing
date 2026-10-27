<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import ProductGallery from '~/components/product_gallery.vue'
import VariantSelector from '~/components/products/variant_selector.vue'
import PriceTierTable from '~/components/products/price_tier_table.vue'
import DocumentList from '~/components/documents/document_list.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import ProductQuoteActions from '~/components/products/product_quote_actions.vue'
import type { ProductDetailType } from '#shared/types/product'
import type { ProductRfqContextType } from '#shared/types/rfq'

const props = defineProps<{ product: ProductDetailType; rfqContext: ProductRfqContextType }>()

const { t, locale } = useI18n()

const selectedVariantId = ref<number | null>(props.product.variants[0]?.id ?? null)
const selectedVariant = computed(
  () => props.product.variants.find((variant) => variant.id === selectedVariantId.value) ?? null
)

// Grille de la variante choisie si elle a ses propres paliers, sinon celle du produit.
const tiers = computed(() => {
  const own = props.product.priceTiers.filter((tier) => tier.variantId === selectedVariantId.value)
  return own.length > 0 ? own : props.product.priceTiers.filter((tier) => tier.variantId === null)
})

const price = computed(() => {
  const { priceMin, priceMax, currency } = props.product
  if (!priceMin && !priceMax) return null
  if (priceMin && priceMax && priceMin !== priceMax) return `${priceMin} – ${priceMax} ${currency}`
  return `${priceMin ?? priceMax} ${currency}`
})

// Conditionnement / logistique (écart 3) : lignes renseignées uniquement.
// Les 3 dimensions du carton maître sont regroupées en « L × l × H ».
const packagingRows = computed(() => {
  const p = props.product.packaging
  if (!p) return []
  const rows: { label: string; value: string }[] = []
  const add = (key: string, value: string | number | null) => {
    if (value !== null && value !== '') rows.push({ label: t(key), value: String(value) })
  }
  add('products.manage.fields.packageType', p.packageType)
  add('products.manage.fields.unitGrossWeightG', p.unitGrossWeightG)
  add('products.manage.fields.innerCartonQty', p.innerCartonQty)
  add('products.manage.fields.outerCartonQty', p.outerCartonQty)
  if (p.outerCartonLengthMm || p.outerCartonWidthMm || p.outerCartonHeightMm) {
    rows.push({
      label: t('products.show.cartonDimensions'),
      value: [p.outerCartonLengthMm, p.outerCartonWidthMm, p.outerCartonHeightMm]
        .map((mm) => mm ?? '—')
        .join(' × '),
    })
  }
  add('products.manage.fields.outerCartonGrossWeightG', p.outerCartonGrossWeightG)
  add('products.manage.fields.outerCartonVolumeM3', p.outerCartonVolumeM3)
  return rows
})

// Marquage structuré (écart 2) : donnée de fiche (jamais un filtre). Affiché dès
// qu'une position ou un palier de prix de marquage est renseigné.
const hasMarking = computed(
  () => props.product.markingPositions.length > 0 || props.product.markingPriceTiers.length > 0
)
</script>

<template>
  <Head :title="product.name ?? product.slug" />

  <div class="mx-auto flex max-w-[960px] flex-col gap-8 px-6 py-12">
    <Link
      route="products.index"
      :params="{ locale }"
      class="text-sm text-[var(--color-primary)] hover:underline"
    >
      ← {{ t('products.show.backToCatalogue') }}
    </Link>

    <div class="flex flex-col gap-8 md:flex-row">
      <ProductGallery
        :images="product.images"
        :fallback-url="product.imageUrl"
        :alt="product.name ?? product.slug"
        :focus-image-id="selectedVariant?.imageId ?? null"
      />

      <div class="flex flex-1 flex-col gap-4">
        <div>
          <h1 class="text-[28px] tracking-[-0.5px]">{{ product.name ?? product.slug }}</h1>
          <Link
            route="suppliers.show"
            :params="{ locale, slug: product.supplier.slug }"
            class="text-sm text-[var(--color-primary)] hover:underline"
          >
            {{ product.supplier.name ?? product.supplier.slug }}
          </Link>
        </div>

        <p v-if="price" class="text-xl font-medium">{{ price }}</p>
        <p v-if="product.description" class="text-[var(--gray-6)]">{{ product.description }}</p>

        <VariantSelector
          v-if="product.variants.length > 0"
          :variants="product.variants"
          :selected-id="selectedVariantId"
          @select="selectedVariantId = $event"
        />
        <PriceTierTable v-if="tiers.length > 0" :tiers="tiers" />

        <dl class="flex flex-col gap-2 text-sm">
          <div
            v-if="product.minQuantity"
            class="flex justify-between border-b border-[var(--gray-3)] py-1"
          >
            <dt class="text-[var(--gray-6)]">{{ t('products.show.minQuantity') }}</dt>
            <dd>{{ product.minQuantity }}</dd>
          </div>
          <div
            v-if="product.category"
            class="flex justify-between border-b border-[var(--gray-3)] py-1"
          >
            <dt class="text-[var(--gray-6)]">{{ t('products.show.category') }}</dt>
            <dd>{{ product.category.name ?? product.category.slug }}</dd>
          </div>
          <div
            v-if="product.originCountry"
            class="flex justify-between border-b border-[var(--gray-3)] py-1"
          >
            <dt class="text-[var(--gray-6)]">{{ t('products.show.origin') }}</dt>
            <dd>{{ product.originCountry }}</dd>
          </div>
          <div
            v-for="attribute in product.attributes"
            :key="attribute.attributeSlug"
            class="flex justify-between border-b border-[var(--gray-3)] py-1"
          >
            <dt class="text-[var(--gray-6)]">
              {{ attribute.attributeName ?? attribute.attributeSlug }}
            </dt>
            <dd>{{ attribute.label }}</dd>
          </div>
        </dl>

        <section
          v-if="product.isEco || product.certifications.length > 0 || product.cautionComment"
          class="flex flex-col gap-3"
        >
          <h2 class="font-medium">{{ t('products.show.compliance') }}</h2>
          <div class="flex flex-wrap gap-2">
            <BaseBadge v-if="product.isEco" tone="success">
              {{ t('products.show.eco') }}
            </BaseBadge>
            <BaseBadge
              v-for="certification in product.certifications"
              :key="certification.id"
              tone="info"
            >
              {{ certification.name ?? certification.slug }}
            </BaseBadge>
          </div>
          <p v-if="product.recycledContentPercent" class="text-sm text-[var(--gray-7)]">
            {{ t('products.show.recycledContent', { percent: product.recycledContentPercent }) }}
          </p>
          <p v-if="product.cautionComment" class="text-sm text-[var(--gray-7)]">
            {{ product.cautionComment }}
          </p>
        </section>

        <section v-if="packagingRows.length > 0" class="flex flex-col gap-2">
          <h2 class="font-medium">{{ t('products.show.packaging') }}</h2>
          <dl class="flex flex-col gap-2 text-sm">
            <div
              v-for="row in packagingRows"
              :key="row.label"
              class="flex justify-between border-b border-[var(--gray-3)] py-1"
            >
              <dt class="text-[var(--gray-6)]">{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="hasMarking" class="flex flex-col gap-3">
          <h2 class="font-medium">{{ t('products.show.marking') }}</h2>
          <ul v-if="product.markingPositions.length > 0" class="flex flex-col gap-2 text-sm">
            <li
              v-for="position in product.markingPositions"
              :key="position.id"
              class="border-b border-[var(--gray-3)] py-1"
            >
              <div class="flex justify-between">
                <span class="font-medium">{{ position.name }}</span>
                <span
                  v-if="position.maxWidthMm || position.maxHeightMm"
                  class="text-[var(--gray-6)]"
                >
                  {{ position.maxWidthMm ?? '—' }} × {{ position.maxHeightMm ?? '—' }} mm
                </span>
              </div>
              <p v-if="position.techniques.length > 0" class="text-[var(--gray-7)]">
                {{
                  position.techniques
                    .map((technique) => technique.techniqueName ?? technique.techniqueSlug)
                    .join(', ')
                }}
              </p>
            </li>
          </ul>

          <div v-if="product.markingPriceTiers.length > 0" class="flex flex-col gap-1">
            <h3 class="text-sm font-medium">{{ t('products.show.markingPrices') }}</h3>
            <dl class="flex flex-col gap-1 text-sm">
              <div
                v-for="tier in product.markingPriceTiers"
                :key="tier.id"
                class="flex justify-between border-b border-[var(--gray-3)] py-1"
              >
                <dt class="text-[var(--gray-6)]">
                  {{ tier.techniqueName ?? tier.techniqueSlug }} ·
                  {{ t('products.show.tierFrom', { quantity: tier.minQuantity }) }}
                </dt>
                <dd>{{ Number(tier.unitPrice) }} {{ tier.currency }}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section v-if="product.documents.length > 0" class="flex flex-col gap-2">
          <h2 class="font-medium">{{ t('documents.datasheet.title') }}</h2>
          <DocumentList
            :documents="product.documents"
            :label-for="(document) => t(`documents.types.${document.type}`)"
          />
        </section>

        <ProductQuoteActions :product-id="product.id" :rfq-context="rfqContext" />
      </div>
    </div>
  </div>
</template>
