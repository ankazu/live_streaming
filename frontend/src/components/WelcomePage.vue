<script setup lang="ts">
const emit = defineEmits<{
  openAuth: [mode: 'login' | 'register']
}>()
</script>

<template>
  <section
    class="mx-auto grid min-h-[calc(100vh-90px)] max-w-3xl items-center py-16 text-center lg:py-10"
  >
    <div>
      <p class="eyebrow">LIVE STREAMING MVP</p>
      <h1
        class="font-display text-ink mx-auto mt-5 max-w-xl text-6xl leading-[0.98] font-semibold tracking-[-3px] sm:text-7xl"
      >
        歡迎來到<br /><em class="text-coral not-italic">你的直播現場。</em>
      </h1>
      <p class="text-muted mx-auto mt-6 max-w-md text-lg leading-8">
        登入後立即預覽鏡頭、建立直播，並和觀眾一起開始互動。
      </p>
      <div class="mt-9 flex flex-wrap justify-center gap-4">
        <button
          class="bg-coral shadow-coral/20 rounded-full px-6 py-4 font-semibold text-white shadow-lg"
          @click="emit('openAuth', 'login')"
        >
          登入開始
        </button>
        <button
          class="text-ink rounded-full border border-[#ddd4cc] px-6 py-4 font-semibold"
          @click="emit('openAuth', 'register')"
        >
          建立帳號
        </button>
      </div>
    </div>
  </section>
</template>
