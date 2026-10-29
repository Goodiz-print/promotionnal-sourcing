<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { ProductDetailType } from '#shared/types/product'

/** Conformité (écart 4) : éco-responsabilité, labels, part de recyclé, mise en garde. */
const props = defineProps<{ product: ProductDetailType }>()

const { t } = useI18n()

const visible = computed(
  () =>
    props.product.isEco ||
    props.product.certifications.length > 0 ||
    Boolean(props.product.cautionComment)
)
</script>

<template>
  <BaseSection v-if="visible" :title="t('products.show.compliance')">
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap gap-1.5">
        <BaseBadge v-if="product.isEco" tone="success">{{ t('products.show.eco') }}</BaseBadge>
        <BaseBadge
          v-for="certification in product.certifications"
          :key="certification.id"
          tone="info"
        >
          {{ certification.name ?? certification.slug }}
        </BaseBadge>
      </div>
      <p v-if="product.recycledContentPercent" class="text-body-sm text-text-secondary">
        {{ t('products.show.recycledContent', { percent: product.recycledContentPercent }) }}
      </p>
      <p v-if="product.cautionComment" class="text-body-sm text-text-secondary">
        {{ product.cautionComment }}
      </p>
    </div>
  </BaseSection>
</template>
