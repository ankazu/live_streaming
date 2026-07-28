<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { createStream, endStream, getStreams, startStream } from '../api/streams'
import { useAuthStore } from '../stores/auth/store'
import type { Stream } from '../types/stream'

const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore()
const title = ref('')
const description = ref('')
const streams = ref<Stream[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const myStreams = computed(() =>
  streams.value.filter((stream) => stream.broadcasterId === auth.user?.id),
)

async function refresh() {
  streams.value = await getStreams()
}

async function submit() {
  isLoading.value = true
  error.value = null
  try {
    await createStream({ title: title.value, description: description.value })
    title.value = ''
    description.value = ''
    await refresh()
    emit('changed')
  } catch (requestError: unknown) {
    error.value = getRequestMessage(requestError)
  } finally {
    isLoading.value = false
  }
}

async function updateStatus(stream: Stream, action: 'start' | 'end') {
  isLoading.value = true
  error.value = null
  try {
    if (action === 'start') await startStream(stream.id)
    else await endStream(stream.id)
    await refresh()
    emit('changed')
  } catch (requestError: unknown) {
    error.value = getRequestMessage(requestError)
  } finally {
    isLoading.value = false
  }
}

function getRequestMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return '目前無法完成操作，請稍後再試。'
}

onMounted(async () => {
  try {
    await refresh()
  } catch {
    error.value = '目前無法載入你的直播。'
  }
})
</script>

<template>
  <section
    v-if="auth.user?.role === 'broadcaster'"
    class="border-coral/20 bg-coral/5 mb-10 rounded-2xl border p-6"
  >
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="eyebrow">BROADCASTER STUDIO</p>
        <h2 class="font-display text-ink mt-2 text-2xl font-semibold">準備開始直播？</h2>
      </div>
      <span
        v-if="auth.user.accountStatus === 'pending'"
        class="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"
        >等待審核</span
      >
    </div>
    <form class="grid gap-3 md:grid-cols-[1fr_1fr_auto]" @submit.prevent="submit">
      <input
        v-model.trim="title"
        class="studio-input"
        placeholder="直播標題"
        required
        minlength="3"
      />
      <input v-model.trim="description" class="studio-input" placeholder="直播簡介（選填）" />
      <button
        class="bg-coral rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        :disabled="isLoading || auth.user.accountStatus !== 'active'"
      >
        建立直播
      </button>
    </form>
    <p v-if="auth.user.accountStatus === 'pending'" class="text-muted mt-3 text-sm">
      帳號通過審核後才能開始直播。
    </p>
    <p v-if="error" class="text-coral mt-3 text-sm">{{ error }}</p>
    <div v-if="myStreams.length" class="mt-6 grid gap-3 sm:grid-cols-2">
      <article
        v-for="stream in myStreams"
        :key="stream.id"
        class="flex items-center justify-between rounded-xl bg-white/70 p-4"
      >
        <div>
          <h3 class="text-ink font-semibold">{{ stream.title }}</h3>
          <p class="text-muted text-xs">{{ stream.status }}</p>
        </div>
        <button
          v-if="stream.status === 'scheduled'"
          class="text-coral text-sm font-semibold"
          :disabled="isLoading || auth.user.accountStatus !== 'active'"
          @click="updateStatus(stream, 'start')"
        >
          Start
        </button>
        <button
          v-else-if="stream.status === 'live'"
          class="text-coral text-sm font-semibold"
          :disabled="isLoading"
          @click="updateStatus(stream, 'end')"
        >
          End
        </button>
      </article>
    </div>
  </section>
</template>
