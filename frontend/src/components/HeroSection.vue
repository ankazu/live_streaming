<script setup lang="ts">
const emit = defineEmits<{ openAuth: [mode: 'register'] }>()
</script>

<template>
  <section class="grid min-h-[570px] items-center gap-12 py-16 lg:grid-cols-[.9fr_1.1fr] lg:py-0">
    <div>
      <p class="eyebrow">YOUR MOMENT, LIVE</p>
      <h1
        class="font-display text-ink mt-5 text-6xl leading-[.98] font-semibold tracking-[-3px] sm:text-7xl lg:text-[86px]"
      >
        Share what<br /><em class="text-coral not-italic">moves</em> you.
      </h1>
      <p class="text-muted mt-6 max-w-[390px] leading-7">
        A warmer place to go live, connect with your people, and discover something new every day.
      </p>
      <div class="mt-8 flex items-center gap-6">
        <button
          class="bg-coral shadow-coral/20 rounded-full px-5 py-4 font-semibold text-white shadow-lg"
          @click="emit('openAuth', 'register')"
        >
          Explore live streams <span class="ml-3 text-lg">→</span>
        </button>
        <a class="text-muted text-sm font-semibold" href="#how-it-works">
          How it works <span class="ml-2 text-lg">↗</span>
        </a>
      </div>
    </div>
    <div class="relative grid min-h-[430px] place-items-center" aria-label="直播預覽示意">
      <div
        class="absolute top-[4%] right-[10%] h-[360px] w-[360px] rounded-full bg-[#f7c79d] blur-[1px]"
      ></div>
      <div
        class="absolute bottom-[3%] left-[4%] h-[170px] w-[170px] rounded-full bg-[#b8d9cc] blur-[1px]"
      ></div>
      <div
        class="relative w-[min(440px,85%)] rotate-1 rounded-[14px] border-[10px] border-white bg-white shadow-2xl shadow-[#4b3a2d]/15"
      >
        <div
          class="relative h-[255px] overflow-hidden rounded-lg bg-gradient-to-br from-[#ff967d] to-[#39283e]"
        >
          <span class="live-pill">● LIVE</span
          ><span class="absolute inset-0 grid place-items-center text-5xl text-white">▶</span
          ><span class="absolute top-5 right-7 text-[190px] leading-none text-white/25">☼</span>
        </div>
        <div class="flex justify-between px-1 py-4 text-[13px]">
          <strong>Morning studio session</strong><span class="text-coral">◉ 2.4K watching</span>
        </div>
      </div>
      <div
        class="bg-ink shadow-ink/20 absolute right-[-2%] bottom-9 rotate-[-4deg] rounded-xl px-5 py-4 text-[13px] leading-6 text-white shadow-xl"
      >
        ✦ <strong>Real people.</strong><br />Real moments.
      </div>
    </div>
  </section>
</template>
