<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, dismissToast } = useToast()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-5 z-50 flex flex-col items-center gap-3 px-4"
    aria-atomic="false"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :data-testid="`toast-${toast.type}`"
      class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur"
      :class="{
        'border-sky-200/30 bg-sky-950/95 text-sky-50': toast.type === 'info',
        'border-emerald-200/30 bg-emerald-950/95 text-emerald-50': toast.type === 'success',
        'border-coral/40 bg-[#3a1820]/95 text-white': toast.type === 'error',
      }"
      :role="toast.type === 'error' ? 'alert' : 'status'"
      :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true"
    >
      <span class="min-w-0 flex-1 break-words">{{ toast.message }}</span>
      <button
        data-testid="toast-dismiss"
        class="shrink-0 rounded-full px-2 text-lg leading-none text-white/70 hover:bg-white/10 hover:text-white"
        type="button"
        aria-label="關閉通知"
        @click="dismissToast(toast.id)"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  </div>
</template>
