<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useToast } from '../composables/useToast'
import { useAuthStore } from '../stores/auth/store'

const props = defineProps<{ mode: 'login' | 'register' }>()
const emit = defineEmits<{ close: []; switchMode: [mode: 'login' | 'register'] }>()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const displayName = ref('')
const { showToast } = useToast()

const modal = ref<HTMLElement | null>(null)

async function submit() {
  const success =
    props.mode === 'login'
      ? await auth.login({ email: email.value, password: password.value })
      : await auth.register({
          email: email.value,
          password: password.value,
          displayName: displayName.value,
        })
  if (success) {
    emit('close')
  } else if (auth.error) {
    showToast(auth.error, 'error')
  }
}

function focusFirstField() {
  nextTick(() => modal.value?.querySelector<HTMLElement>('input, select, button')?.focus())
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !modal.value) return

  const focusable = [...modal.value.querySelectorAll<HTMLElement>('button, input, select')].filter(
    (element) => !element.hasAttribute('disabled'),
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.body.style.overflow = 'hidden'
  focusFirstField()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})

watch(() => props.mode, focusFirstField)
</script>

<template>
  <div class="bg-ink/60 fixed inset-0 z-10 grid place-items-center p-5" @click.self="emit('close')">
    <section
      ref="modal"
      class="bg-paper relative w-full max-w-[430px] rounded-2xl p-8 shadow-2xl sm:p-10"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`${mode}-title`"
    >
      <button
        class="text-muted absolute top-2 right-4 text-3xl"
        aria-label="關閉"
        @click="emit('close')"
      >
        ×
      </button>
      <p class="eyebrow">{{ mode === 'login' ? 'WELCOME BACK' : 'JOIN THE MOMENT' }}</p>
      <h2 :id="`${mode}-title`" class="font-display text-ink mt-2 mb-7 text-3xl font-semibold">
        {{ mode === 'login' ? 'Log in to live.' : 'Create your account.' }}
      </h2>
      <form class="grid gap-4" @submit.prevent="submit">
        <label v-if="mode === 'register'" class="form-label"
          >Display name<input v-model.trim="displayName" required autocomplete="name"
        /></label>
        <label class="form-label"
          >Email<input v-model.trim="email" required type="email" autocomplete="email"
        /></label>
        <label class="form-label"
          >Password<input
            v-model="password"
            required
            minlength="8"
            type="password"
            autocomplete="current-password"
        /></label>

        <button
          class="bg-coral shadow-coral/20 rounded-full px-5 py-3 font-semibold text-white shadow-lg disabled:cursor-wait disabled:opacity-60"
          :disabled="auth.isLoading"
        >
          {{ auth.isLoading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account' }}
        </button>
      </form>
      <button
        class="text-coral mt-5 w-full text-sm"
        @click="emit('switchMode', mode === 'login' ? 'register' : 'login')"
      >
        {{ mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in' }}
      </button>
    </section>
  </div>
</template>
