<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
</script>

<template>
  <Head :title="t('home.head')" />

  <div class="max-w-[880px] px-12.5 py-25">
    <h1 class="mb-3.75 text-[52px] leading-[1.05] font-semibold tracking-[-1px]">
      {{ t('home.title') }}
    </h1>
    <p class="text-[22px] text-[var(--gray-7)]">
      {{ t('home.subtitle') }}
    </p>
  </div>

  <div class="grid grid-cols-3 border-t border-[var(--gray-3)] px-12.5">
    <a
      href="https://insiders.adonisjs.com/docs/v7-alpha/introduction"
      target="_blank"
      class="border-r border-l border-[var(--gray-3)] px-10 py-7.5 hover:bg-[var(--gray-1)]"
    >
      <h3 class="mb-2.5 text-xl font-semibold tracking-[-0.4px]">
        {{ t('home.cards.docs.title') }} &nbsp;›
      </h3>
      <p class="text-[var(--gray-6)]">{{ t('home.cards.docs.description') }}</p>
    </a>

    <a
      href="https://adocasts.com/"
      target="_blank"
      class="border-r border-[var(--gray-3)] px-10 py-7.5 hover:bg-[var(--gray-1)]"
    >
      <h3 class="mb-2.5 text-xl font-semibold tracking-[-0.4px]">
        {{ t('home.cards.adocasts.title') }} &nbsp;›
      </h3>
      <p class="text-[var(--gray-6)]">{{ t('home.cards.adocasts.description') }}</p>
    </a>

    <a
      href="https://discord.gg/vDcEjq6"
      target="_blank"
      class="border-r border-[var(--gray-3)] px-10 py-7.5 hover:bg-[var(--gray-1)]"
    >
      <h3 class="mb-2.5 text-xl font-semibold tracking-[-0.4px]">
        {{ t('home.cards.discord.title') }} &nbsp;›
      </h3>
      <p class="text-[var(--gray-6)]">{{ t('home.cards.discord.description') }}</p>
    </a>
  </div>
</template>
