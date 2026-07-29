<script setup lang="ts">
import { ref } from 'vue'

import { createStream, startStream } from '../api/streams'
import { useAuthStore } from '../stores/auth/store'
import type { Stream } from '../types/stream'
import { createAndStartStream } from './broadcaster-flow'

const props = defineProps<{ activeStream?: Stream | null }>()
const emit = defineEmits<{ liveCreated: [stream: Stream] }>()
const auth = useAuthStore()
const isLoading = ref(false)
const error = ref<string | null>(null)

async function submit() {
  isLoading.value = true
  error.value = null
  try {
    const stream = await createAndStartStream({}, createStream, startStream)
    emit('liveCreated', stream)
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
  return '目前無法開始直播，請稍後再試。'
}
</script>

<template>
  <section
    v-if="auth.user?.role === 'broadcaster'"
    class="border-coral/20 bg-coral/5 rounded-3xl border p-6"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="eyebrow">BROADCASTER STUDIO</p>
        <h2 class="font-display text-ink mt-2 text-2xl font-semibold">
          {{ props.activeStream ? '直播進行中' : '準備開始直播？' }}
        </h2>
      </div>
      <span
        v-if="auth.user.accountStatus === 'pending'"
        class="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"
        >等待審核</span
      >
    </div>

    <template v-if="props.activeStream">
      <p class="text-muted mt-5 text-sm">把這組代碼分享給觀眾，他們就能加入你的直播。</p>
      <div class="mt-4 rounded-2xl bg-white px-5 py-4 text-center">
        <p class="text-muted text-xs tracking-[2px] uppercase">LIVE CODE</p>
        <p class="text-ink mt-2 font-mono text-4xl font-semibold tracking-[8px]">
          {{ props.activeStream.joinCode }}
        </p>
      </div>
    </template>
    <template v-else>
      <p class="text-muted mt-2 text-sm leading-6">
        開播後會自動產生直播標題與 6 位數代碼，你只需要把代碼分享給觀眾。
      </p>
      <button
        class="bg-coral mt-6 w-full rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        :disabled="isLoading || auth.user?.accountStatus !== 'active'"
        @click="submit"
      >
        {{ isLoading ? '開播中…' : '開始直播' }}
      </button>
    </template>

    <p v-if="auth.user?.accountStatus === 'pending'" class="text-muted mt-3 text-sm">
      帳號通過審核後才能開始直播。
    </p>
    <p v-if="error" class="text-coral mt-3 text-sm" role="alert">{{ error }}</p>
  </section>
</template>
