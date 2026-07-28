<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import AuthModal from './components/AuthModal.vue'
import BroadcasterStudio from './components/BroadcasterStudio.vue'
import HeroSection from './components/HeroSection.vue'
import SiteHeader from './components/SiteHeader.vue'
import StreamGrid from './components/StreamGrid.vue'
import { useAuthStore } from './stores/auth/store'

const auth = useAuthStore()
const authMode = ref<'login' | 'register' | null>(null)
const searchQuery = ref('')
const streamsRefreshKey = ref(0)

function handleUnauthorized() {
  auth.handleUnauthorized()
  authMode.value = 'login'
}

onMounted(() => {
  window.addEventListener('auth:unauthorized', handleUnauthorized)
  auth.restoreSession()
})

onUnmounted(() => window.removeEventListener('auth:unauthorized', handleUnauthorized))
</script>

<template>
  <main class="mx-auto max-w-[1280px] overflow-hidden px-6 sm:px-14">
    <SiteHeader @open-auth="authMode = $event" @update-search="searchQuery = $event" />
    <HeroSection @open-auth="authMode = $event" />
    <BroadcasterStudio @changed="streamsRefreshKey++" />
    <StreamGrid
      :search-query="searchQuery"
      :refresh-key="streamsRefreshKey"
      :is-authenticated="auth.isAuthenticated"
      @open-auth="authMode = 'login'"
    />
    <section id="how-it-works" class="bg-ink mb-16 rounded-2xl px-6 py-10 text-white sm:px-10">
      <p class="eyebrow">HOW IT WORKS</p>
      <h2 class="font-display mt-3 text-3xl font-semibold">Find your people, then go live.</h2>
      <p class="mt-3 max-w-2xl leading-7 text-white/70">
        探索正在發生的直播，或註冊成為 broadcaster，建立自己的直播並與觀眾互動。
      </p>
    </section>
    <footer
      id="about"
      class="flex flex-wrap items-center gap-6 border-t border-[#e5e0da] py-8 text-xs text-[#9b8e85]"
    >
      <span class="font-display text-ink mr-auto text-xl font-bold tracking-[-1.5px]"
        >live<span class="text-coral">.</span></span
      ><span>Made for moments that matter.</span><span>© 2026 live-streaming</span>
    </footer>
    <AuthModal
      v-if="authMode"
      :mode="authMode"
      @close="authMode = null"
      @switch-mode="authMode = $event"
    />
  </main>
</template>
