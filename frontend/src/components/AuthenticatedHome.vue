<script setup lang="ts">
import { ref } from 'vue'

import CameraPreview from './CameraPreview.vue'
import BroadcasterStudio from './BroadcasterStudio.vue'
import StreamGrid from './StreamGrid.vue'
import SiteHeader from './SiteHeader.vue'
import { useAuthStore } from '../stores/auth/store'

const emit = defineEmits<{ openAuth: [] }>()
const auth = useAuthStore()
const streamsRefreshKey = ref(0)
</script>

<template>
  <main class="mx-auto max-w-[1280px] overflow-hidden px-6 sm:px-14">
    <SiteHeader dashboard />
    <section class="border-b border-[#e5e0da] py-10 sm:py-14">
      <div class="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p class="eyebrow">YOUR LIVE DESK</p>
          <h1
            class="font-display text-ink mt-2 text-4xl font-semibold tracking-[-1.5px] sm:text-5xl"
          >
            嗨，{{ auth.user?.displayName }}
          </h1>
          <p class="text-muted mt-3">今天想分享什麼？先從鏡頭預覽開始。</p>
        </div>
      </div>
    </section>
    <section class="grid gap-8 py-10 lg:grid-cols-[1.35fr_0.65fr]">
      <CameraPreview />
      <aside class="rounded-3xl border border-[#e5e0da] bg-white/65 p-6">
        <p class="eyebrow">QUICK START</p>
        <h2 class="font-display text-ink mt-3 text-2xl font-semibold">三步開始你的直播</h2>
        <ol class="text-muted mt-6 grid gap-5 text-sm leading-6">
          <li><strong class="text-ink">01</strong><br />開啟鏡頭，確認畫面與光線。</li>
          <li>
            <strong class="text-ink">02</strong><br />建立直播標題，讓觀眾知道你正在分享什麼。
          </li>
          <li><strong class="text-ink">03</strong><br />開始直播，進入即時互動。</li>
        </ol>
        <div class="mt-8 rounded-2xl bg-[#f7f4ef] p-4 text-sm">
          <span class="text-coral font-semibold">{{
            auth.user?.role === 'broadcaster' ? 'BROADCASTER' : 'VIEWER'
          }}</span>
          <p class="text-muted mt-1">你的登入狀態已準備完成。</p>
        </div>
      </aside>
    </section>
    <BroadcasterStudio @changed="streamsRefreshKey++" />
    <StreamGrid
      :is-authenticated="true"
      :refresh-key="streamsRefreshKey"
      @open-auth="emit('openAuth')"
    />
  </main>
</template>
