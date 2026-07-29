<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import AuthenticatedHome from './components/AuthenticatedHome.vue'
import AuthModal from './components/AuthModal.vue'
import WelcomePage from './components/WelcomePage.vue'
import { useAuthStore } from './stores/auth/store'

const auth = useAuthStore()
const authMode = ref<'login' | 'register' | null>(null)

function handleUnauthorized() {
  auth.handleUnauthorized()
  authMode.value = 'login'
}

onMounted(() => {
  window.addEventListener('auth:unauthorized', handleUnauthorized)
  auth.restoreSession()
})

onUnmounted(() => window.removeEventListener('auth:unauthorized', handleUnauthorized))
</script>

<template>
  <WelcomePage v-if="!auth.isAuthenticated" @open-auth="authMode = $event" />
  <AuthenticatedHome v-else @open-auth="authMode = 'login'" />
  <AuthModal
    v-if="authMode"
    :mode="authMode"
    @close="authMode = null"
    @switch-mode="authMode = $event"
  />
</template>
