<script setup lang="ts">
import { ref } from 'vue'

import { getStreamByJoinCode } from '../api/streams'
import { useToast } from '../composables/useToast'
import type { Stream } from '../types/stream'

const emit = defineEmits<{ watchLive: [stream: Stream] }>()
const joinCode = ref('')
const isLoading = ref(false)
const { showToast } = useToast()

async function submit() {
  const code = joinCode.value.trim()
  if (!/^\d{6}$/.test(code)) {
    showToast('請輸入 6 位數直播代碼。', 'error')
    return
  }

  isLoading.value = true
  try {
    const stream = await getStreamByJoinCode(code)
    emit('watchLive', stream)
  } catch {
    showToast('找不到這場直播，請確認代碼仍然有效。', 'error')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <section class="rounded-3xl border border-[#e5e0da] bg-white/65 p-6">
    <p class="eyebrow">JOIN A LIVE</p>
    <h2 class="font-display text-ink mt-3 text-2xl font-semibold">輸入直播代碼</h2>
    <p class="text-muted mt-2 text-sm leading-6">向主播取得 6 位數代碼，就能直接加入直播。</p>
    <form class="mt-6 grid gap-3" @submit.prevent="submit">
      <input
        v-model="joinCode"
        class="studio-input font-mono tracking-[3px]"
        inputmode="numeric"
        maxlength="6"
        pattern="[0-9]{6}"
        placeholder="例如 482731"
        aria-label="直播代碼"
      />
      <button
        class="bg-coral rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        type="submit"
        :disabled="isLoading"
      >
        {{ isLoading ? '確認中…' : '確認代碼' }}
      </button>
    </form>
  </section>
</template>
