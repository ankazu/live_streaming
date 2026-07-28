<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { getStreams } from '../api/streams'
import LiveKitRoom from './LiveKitRoom.vue'
import type { Stream } from '../types/stream'

const emit = defineEmits<{ openAuth: [] }>()
const props = withDefaults(
  defineProps<{ searchQuery?: string; refreshKey?: number; isAuthenticated?: boolean }>(),
  {
    searchQuery: '',
    refreshKey: 0,
    isAuthenticated: false,
  },
)

const streams = ref<Stream[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const showAll = ref(false)
const colors = ['#ff7a59', '#6c63ff', '#1da1a2', '#e4a853']
const selectedStream = ref<Stream | null>(null)

const filteredStreams = computed(() => {
  const query = props.searchQuery.trim().toLowerCase()
  const result = query
    ? streams.value.filter((stream) =>
        `${stream.title} ${stream.description}`.toLowerCase().includes(query),
      )
    : streams.value
  return showAll.value ? result : result.slice(0, 3)
})

async function loadStreams() {
  isLoading.value = true
  error.value = null
  try {
    streams.value = await getStreams()
  } catch {
    error.value = '目前無法載入直播，請確認 backend 已啟動。'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadStreams)
watch(() => props.refreshKey, loadStreams)

function joinStream(stream: Stream) {
  if (!props.isAuthenticated) {
    emit('openAuth')
    return
  }
  selectedStream.value = stream
}
</script>

<template>
  <section id="categories" class="pt-10 pb-20">
    <div class="mb-7 flex items-end justify-between gap-4">
      <div>
        <p class="eyebrow">RIGHT NOW</p>
        <h2 class="font-display text-ink mt-2 text-3xl font-semibold">Live and happening</h2>
      </div>
      <button
        v-if="streams.length > 3"
        class="text-coral text-sm font-semibold"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show less' : 'View all' }} <span class="ml-2 text-lg">→</span>
      </button>
    </div>

    <p v-if="isLoading" class="text-muted py-10 text-center">Loading live streams…</p>
    <p v-else-if="error" class="text-coral py-10 text-center">{{ error }}</p>
    <p v-else-if="filteredStreams.length === 0" class="text-muted py-10 text-center">
      {{ searchQuery ? '找不到符合的直播。' : '目前還沒有直播。' }}
    </p>
    <div v-else class="grid gap-6 md:grid-cols-3">
      <article v-for="(stream, index) in filteredStreams" :key="stream.id">
        <div
          class="relative h-[255px] overflow-hidden rounded-lg"
          :style="{
            background: `linear-gradient(135deg, ${colors[index % colors.length]}, #17141f)`,
          }"
        >
          <span class="live-pill">{{ stream.status === 'live' ? '● LIVE' : 'SCHEDULED' }}</span>
          <span
            class="text-ink absolute top-3 right-3 rounded bg-white/85 px-2 py-1 font-mono text-[10px]"
            >◉ {{ stream.viewerCount }}</span
          >
          <span class="absolute inset-0 grid place-items-center text-7xl text-white/75">✦</span>
        </div>
        <p class="mt-4 font-mono text-[11px] tracking-[1px] text-[#9b8e85] uppercase">STREAM</p>
        <h3 class="font-display text-ink mt-1 text-xl font-semibold">{{ stream.title }}</h3>
        <p class="text-muted text-sm">Broadcaster</p>
        <button
          v-if="stream.status === 'live'"
          class="text-coral mt-3 text-sm font-semibold"
          @click="joinStream(stream)"
        >
          Watch live →
        </button>
      </article>
    </div>
    <LiveKitRoom
      v-if="selectedStream"
      :stream-id="selectedStream.id"
      :title="selectedStream.title"
    />
  </section>
</template>
