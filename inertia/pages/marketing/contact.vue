<script setup lang="ts">
import ContactForm from '~/components/marketing/contact_form.vue'
import MarketingHead from '~/components/marketing/marketing_head.vue'
import { useMarketing } from '~/composables/use_marketing'
import MarketingLayout from '~/layouts/marketing.vue'
import type { ContactRequestType } from '#shared/types/marketing'

defineOptions({ layout: MarketingLayout })
defineProps<{ siteUrl: string; initialType: ContactRequestType }>()

const { t, email } = useMarketing()

/* Adresse postale du siège : donnée d'identité, identique dans toutes les langues. */
const ADDRESS_LINES = ['PROMOTIONAL SOURCING', '72 quai de Bacalan', '33300 Bordeaux — France']
</script>

<template>
  <MarketingHead
    :title="t('landing.contact.seoTitle')"
    :description="t('landing.contact.seoDescription')"
    :site-url="siteUrl"
  />
  <section class="wrapper py-24">
    <div class="mb-14 max-w-[640px]">
      <p class="mb-3 text-eyebrow text-text-brand">{{ t('landing.contact.eyebrow') }}</p>
      <h1 class="mb-4 text-display-lg">{{ t('landing.contact.heading') }}</h1>
      <p class="text-body-lg text-text-secondary">{{ t('landing.contact.intro') }}</p>
    </div>

    <div class="grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
      <div data-reveal>
        <h2 class="mb-6 text-heading-lg">{{ t('landing.contact.formHeading') }}</h2>
        <ContactForm :initial-type="initialType" />
      </div>

      <aside
        class="flex flex-col gap-8 rounded-xl border border-hairline bg-sunken p-7 lg:self-start"
      >
        <div>
          <p class="mb-2 text-eyebrow text-text-muted">{{ t('landing.contact.asideTitle') }}</p>
          <a
            class="text-body-md font-semibold text-text-brand underline underline-offset-2"
            :href="`mailto:${email}`"
          >
            {{ email }}
          </a>
        </div>
        <div>
          <p class="mb-2 text-eyebrow text-text-muted">
            {{ t('landing.contact.asideAddressTitle') }}
          </p>
          <address class="text-body-md text-text-secondary not-italic">
            <template v-for="(line, i) in ADDRESS_LINES" :key="line">
              <br v-if="i > 0" />{{ line }}
            </template>
          </address>
        </div>
        <div>
          <p class="mb-2 text-eyebrow text-text-muted">
            {{ t('landing.contact.asideResponseTitle') }}
          </p>
          <p class="text-body-md text-text-secondary">{{ t('landing.contact.asideResponse') }}</p>
        </div>
      </aside>
    </div>
  </section>
</template>
