<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'

import { useToast } from '../composables/useToast'

const video = ref<HTMLVideoElement | null>(null)
const cameraStream = ref<MediaStream | null>(null)
const microphoneStream = ref<MediaStream | null>(null)
const isCameraStarting = ref(false)
const isMicrophoneStarting = ref(false)
const { showToast } = useToast()

async function toggleCamera() {
  if (cameraStream.value) {
    stopCamera()
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('目前瀏覽器不支援鏡頭預覽。', 'error')
    return
  }

  isCameraStarting.value = true
  try {
    cameraStream.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    await nextTick()
    if (video.value) video.value.srcObject = cameraStream.value
  } catch {
    showToast('無法取得鏡頭權限，請允許瀏覽器使用攝影機。', 'error')
  } finally {
    isCameraStarting.value = false
  }
}

async function toggleMicrophone() {
  if (microphoneStream.value) {
    stopMicrophone()
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('目前瀏覽器不支援麥克風。', 'error')
    return
  }

  isMicrophoneStarting.value = true
  try {
    microphoneStream.value = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    })
  } catch {
    showToast('無法取得麥克風權限，請允許瀏覽器使用麥克風。', 'error')
  } finally {
    isMicrophoneStarting.value = false
  }
}

function stopCamera() {
  cameraStream.value?.getTracks().forEach((track) => track.stop())
  cameraStream.value = null
  if (video.value) video.value.srcObject = null
}

function stopMicrophone() {
  microphoneStream.value?.getTracks().forEach((track) => track.stop())
  microphoneStream.value = null
}

onBeforeUnmount(() => {
  stopCamera()
  stopMicrophone()
})
</script>

<template>
  <section class="bg-ink rounded-3xl p-4 text-white shadow-xl sm:p-6">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="eyebrow text-white/60">CAMERA PREVIEW</p>
      </div>
      <span class="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
        {{ cameraStream || microphoneStream ? '設備已開啟' : '尚未開啟' }}
      </span>
    </div>
    <div class="relative aspect-video overflow-hidden rounded-2xl bg-[#17141f]">
      <video
        v-if="cameraStream"
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
    <div class="mt-5 flex flex-wrap gap-3">
      <button
        data-testid="toggle-camera"
        class="bg-coral rounded-full p-3 text-white disabled:opacity-60"
        :disabled="isCameraStarting"
        :aria-label="isCameraStarting ? '正在啟動鏡頭' : cameraStream ? '關閉鏡頭' : '開啟鏡頭預覽'"
        :title="isCameraStarting ? '正在啟動鏡頭' : cameraStream ? '關閉鏡頭' : '開啟鏡頭預覽'"
        @click="toggleCamera"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M4 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
          <path d="m17 10 5-3v10l-5-3z" />
          <path v-if="!cameraStream" d="m3 3 18 18" />
        </svg>
      </button>
      <button
        data-testid="toggle-microphone"
        class="rounded-full border border-white/20 bg-white/10 p-3 text-white disabled:opacity-60"
        :disabled="isMicrophoneStarting"
        :aria-label="
          isMicrophoneStarting ? '正在啟動麥克風' : microphoneStream ? '關閉麥克風' : '開啟麥克風'
        "
        :title="
          isMicrophoneStarting ? '正在啟動麥克風' : microphoneStream ? '關閉麥克風' : '開啟麥克風'
        "
        @click="toggleMicrophone"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <rect x="8" y="3" width="8" height="12" rx="4" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
          <path v-if="!microphoneStream" d="m3 3 18 18" />
        </svg>
      </button>
    </div>
  </section>
</template>
