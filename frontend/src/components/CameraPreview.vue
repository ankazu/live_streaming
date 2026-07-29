<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'

const video = ref<HTMLVideoElement | null>(null)
const mediaStream = ref<MediaStream | null>(null)
const isStarting = ref(false)
const error = ref<string | null>(null)

async function toggleCamera() {
  if (mediaStream.value) {
    stopCamera()
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = '目前瀏覽器不支援鏡頭預覽。'
    return
  }

  isStarting.value = true
  error.value = null
  try {
    mediaStream.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    await nextTick()
    if (video.value) video.value.srcObject = mediaStream.value
  } catch {
    error.value = '無法取得鏡頭權限，請允許瀏覽器使用攝影機。'
  } finally {
    isStarting.value = false
  }
}

function stopCamera() {
  mediaStream.value?.getTracks().forEach((track) => track.stop())
  mediaStream.value = null
  if (video.value) video.value.srcObject = null
}

onBeforeUnmount(stopCamera)
</script>

<template>
  <section class="bg-ink rounded-3xl p-4 text-white shadow-xl sm:p-6">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="eyebrow text-white/60">CAMERA PREVIEW</p>
      </div>
      <span class="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
        {{ mediaStream ? '鏡頭已開啟' : '尚未開啟' }}
      </span>
    </div>
    <div class="relative aspect-video overflow-hidden rounded-2xl bg-[#17141f]">
      <video
        v-if="mediaStream"
        ref="video"
        class="h-full w-full object-cover"
        autoplay
        muted
        playsinline
        aria-label="鏡頭預覽"
      />
      <div v-else class="absolute inset-0 grid place-items-center text-center text-white/50">
        <div>
          <div class="text-5xl text-white/30">◉</div>
          <p class="mt-3 text-sm">按下按鈕預覽你的鏡頭</p>
        </div>
      </div>
    </div>
    <p v-if="error" class="text-coral mt-3 text-sm" role="alert">{{ error }}</p>
    <button
      class="bg-coral mt-5 rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      :disabled="isStarting"
      @click="toggleCamera"
    >
      {{ isStarting ? '正在啟動…' : mediaStream ? '關閉鏡頭' : '開啟鏡頭預覽' }}
    </button>
  </section>
</template>
