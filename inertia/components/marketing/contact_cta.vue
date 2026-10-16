<script setup lang="ts">
import { computed } from 'vue'
import BaseLinkButton from '~/components/base_link_button.vue'
import { useMarketing } from '~/composables/use_marketing'

const props = withDefaults(
  defineProps<{
    /** `on-dark` pour la section CTA à fond dégradé, `default` pour la page contact. */
    variant?: 'default' | 'on-dark'
  }>(),
  { variant: 'default' }
)

const { t, email } = useMarketing()
const POINT_INDEXES = [0, 1, 2, 3]

/* Le corps pré-rempli reprend les questions de qualification. RFC 6068 : les sauts de
   ligne du corps doivent être des CRLF, sinon Outlook colle les lignes bout à bout. */
const mailtoHref = computed(() => {
  const body = t('landing.contact.mailBody').replace(/\n/g, '\r\n')
  const subject = encodeURIComponent(t('landing.contact.mailSubject'))
  return `mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`
})

const onDark = computed(() => props.variant === 'on-dark')
</script>

<template>
  <div v-if="onDark" class="flex flex-col items-center gap-5">
    <BaseLinkButton :href="mailtoHref" variant="on-dark">
      {{ t('landing.contact.mailCta') }}<span aria-hidden="true">→</span>
    </BaseLinkButton>
    <p class="text-caption text-indigo-100">
      {{ t('landing.contact.mailFallback') }}
      <a class="font-semibold text-white underline underline-offset-2" :href="`mailto:${email}`">
        {{ email }}
      </a>
    </p>
  </div>
  <div v-else class="max-w-[620px]">
    <p class="text-body-md text-text-secondary">{{ t('landing.contact.mailIntro') }}</p>
    <ul class="mb-8 mt-5 flex flex-col gap-3">
      <li v-for="i in POINT_INDEXES" :key="i" class="flex gap-3 text-body-md text-text-secondary">
        <span class="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden="true" />
        {{ t(`landing.contact.mailPoints.${i}`) }}
      </li>
    </ul>
    <BaseLinkButton :href="mailtoHref">
      {{ t('landing.contact.mailCta') }}<span aria-hidden="true">→</span>
    </BaseLinkButton>
    <p class="mt-4 text-caption text-text-muted">{{ t('landing.contact.mailHint') }}</p>
  </div>
</template>
