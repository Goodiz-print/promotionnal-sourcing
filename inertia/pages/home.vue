<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
</script>

<template>
  <Head title="Homepage" />

  <div class="max-w-[880px] px-12.5 py-25">
    <h1 class="mb-3.75 text-[52px] leading-[1.05] font-semibold tracking-[-1px]">
      It works — welcome to the power of a full-stack Vue app
    </h1>
    <p class="text-[22px] text-[var(--gray-7)]">
      Powered by Inertia and Vue, this setup blends server-driven routing with rich client-side
      interactivity — seamless, fast, and cohesive.
    </p>
  </div>

  <div class="grid grid-cols-3 border-t border-[var(--gray-3)] px-12.5">
    <a
      href="https://insiders.adonisjs.com/docs/v7-alpha/introduction"
      target="_blank"
      class="border-r border-l border-[var(--gray-3)] px-10 py-7.5 hover:bg-[var(--gray-1)]"
    >
      <h3 class="mb-2.5 text-xl font-semibold tracking-[-0.4px]">Official Docs &nbsp;›</h3>
      <p class="text-[var(--gray-6)]">Comprehensive reference for building with AdonisJS</p>
    </a>

    <a
      href="https://adocasts.com/"
      target="_blank"
      class="border-r border-[var(--gray-3)] px-10 py-7.5 hover:bg-[var(--gray-1)]"
    >
      <h3 class="mb-2.5 text-xl font-semibold tracking-[-0.4px]">Adocasts &nbsp;›</h3>
      <p class="text-[var(--gray-6)]">Guided video tutorials for everyday development</p>
    </a>

    <a
      href="https://discord.gg/vDcEjq6"
      target="_blank"
      class="border-r border-[var(--gray-3)] px-10 py-7.5 hover:bg-[var(--gray-1)]"
    >
      <h3 class="mb-2.5 text-xl font-semibold tracking-[-0.4px]">Discord &nbsp;›</h3>
      <p class="text-[var(--gray-6)]">Connect with developers building with AdonisJS every day</p>
    </a>
  </div>
</template>
