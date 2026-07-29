<script setup lang="ts">
import { ref } from 'vue'

import { useAuthStore } from '../stores/auth/store'

const props = withDefaults(defineProps<{ dashboard?: boolean }>(), { dashboard: false })
const emit = defineEmits<{
  openAuth: [mode: 'login' | 'register']
  updateSearch: [query: string]
}>()
const auth = useAuthStore()
const searchOpen = ref(false)
const searchQuery = ref('')

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) {
    searchQuery.value = ''
    emit('updateSearch', '')
  }
}
</script>

<template>
  <header class="flex h-[90px] items-center gap-6 border-b border-[#e5e0da] lg:gap-14">
    <a class="font-display text-[28px] font-bold tracking-[-1.5px]" href="/"
      >live<span class="text-coral">.</span></a
    >
    <nav v-if="!props.dashboard" class="text-muted hidden gap-8 text-sm md:flex">
      <a class="text-ink font-semibold" href="/">Discover</a>
      <a href="#categories">Categories</a>
      <a href="#about">About</a>
    </nav>
    <div class="ml-auto flex items-center gap-4">
      <div
        v-if="!props.dashboard"
        class="flex items-center rounded-full border border-[#ddd4cc] bg-white/60 px-3"
      >
        <input
          v-model="searchQuery"
          class="w-32 bg-transparent py-2 text-sm outline-none"
          placeholder="搜尋直播"
          aria-label="搜尋直播"
          @input="emit('updateSearch', searchQuery)"
        />
      </div>
      <button
        v-if="!props.dashboard"
        class="text-muted text-2xl"
        aria-label="搜尋"
        :aria-expanded="searchOpen"
        @click="toggleSearch"
      >
        ⌕
      </button>
      <span v-if="auth.isRestoring" class="text-muted text-sm">Restoring…</span>
      <template v-else-if="auth.isAuthenticated">
        <span class="text-muted hidden text-sm sm:inline">Hi, {{ auth.user?.displayName }}</span>
        <button class="text-muted text-sm" @click="auth.logout">Log out</button>
      </template>
      <template v-else>
        <button class="text-muted text-sm" @click="emit('openAuth', 'login')">Log in</button>
        <button
          class="bg-coral shadow-coral/20 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg"
          @click="emit('openAuth', 'register')"
        >
          Start streaming
        </button>
      </template>
    </div>
  </header>
</template>
