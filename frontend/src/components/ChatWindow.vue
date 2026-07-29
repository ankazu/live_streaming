<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

import { endStream } from '../api/streams'

const props = defineProps<{ streamId: string; title: string }>()
const emit = defineEmits<{ ended: [] }>()

type ChatMessage = { id: string; displayName: string; content: string }

const socket = ref<Socket>()
const isJoined = ref(false)
const isEnding = ref(false)
const error = ref<string | null>(null)
const chatInput = ref('')
const presenceCount = ref(0)
const messages = ref<ChatMessage[]>([])
let heartbeatTimer: ReturnType<typeof setInterval> | undefined

function connectChat() {
  const token = localStorage.getItem('live-streaming.access-token')
  if (!token) {
    error.value = '登入狀態已失效，無法開啟聊天室。'
    return
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
  const chatSocket = io(apiBaseUrl.replace(/\/api\/?$/, ''), { auth: { token } })
  socket.value = chatSocket
  chatSocket.on('connect', () => {
    chatSocket.emit(
      'stream:join',
      props.streamId,
      (result: { success: boolean; viewerCount?: number }) => {
        if (result.success && result.viewerCount !== undefined) {
          isJoined.value = true
          presenceCount.value = result.viewerCount
          return
        }
        error.value = '聊天室加入直播間失敗。'
        disconnect()
      },
    )
  })
  chatSocket.on('chat:message', (message: ChatMessage) => messages.value.push(message))
  chatSocket.on('stream:ended', ({ streamId }: { streamId: string }) => {
    if (streamId !== props.streamId) return
    error.value = '直播已結束。'
    disconnect()
    emit('ended')
  })
  chatSocket.on(
    'stream:participant-left',
    ({ displayName, role }: { displayName: string; role: string }) => {
      if (role === 'viewer') error.value = `${displayName} 已離開直播。`
    },
  )
  chatSocket.on('presence:count', (data: { viewerCount: number }) => {
    presenceCount.value = data.viewerCount
  })
  chatSocket.on('connect_error', () => (error.value = '聊天室暫時無法連線。'))
  heartbeatTimer = setInterval(() => chatSocket.emit('presence:heartbeat'), 15_000)
}

function sendMessage() {
  const content = chatInput.value.trim()
  if (!content || !socket.value?.connected || !isJoined.value) return

  socket.value.emit('chat:send', content, (result: { success: boolean; code?: string }) => {
    if (!result.success) {
      error.value = result.code === 'RATE_LIMITED' ? '留言太頻繁，請稍後再試。' : '留言未送出。'
      return
    }
    chatInput.value = ''
  })
}

async function finishStream() {
  isEnding.value = true
  error.value = null
  try {
    await endStream(props.streamId)
    emit('ended')
  } catch {
    error.value = '目前無法結束直播，請稍後再試。'
  } finally {
    isEnding.value = false
  }
}

function disconnect() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = undefined
  socket.value?.emit('stream:leave')
  socket.value?.disconnect()
  socket.value = undefined
  isJoined.value = false
}

onMounted(connectChat)
onUnmounted(disconnect)
</script>

<template>
  <aside class="bg-ink flex min-h-[360px] flex-col rounded-3xl p-5 text-white sm:p-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="eyebrow text-white/60">LIVE CHAT</p>
        <h2 class="mt-2 text-xl font-semibold">{{ title }}</h2>
      </div>
      <span class="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
        {{ presenceCount }} 人在線
      </span>
    </div>
    <p v-if="error" class="text-coral mt-3 text-sm" role="alert">{{ error }}</p>
    <div class="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
      <p v-for="message in messages" :key="message.id">
        <strong class="text-coral">{{ message.displayName }}</strong> {{ message.content }}
      </p>
      <p v-if="messages.length === 0" class="text-white/50">成為第一個留言的人。</p>
    </div>
    <form class="mt-5 flex gap-2" @submit.prevent="sendMessage">
      <input
        v-model="chatInput"
        class="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none placeholder:text-white/40"
        maxlength="500"
        placeholder="Say something…"
      />
      <button class="bg-coral rounded-full px-4 py-2 text-sm font-semibold" type="submit">
        Send
      </button>
    </form>
    <button
      class="mt-4 self-start text-sm font-semibold text-white/60 hover:text-white disabled:opacity-50"
      :disabled="isEnding"
      @click="finishStream"
    >
      {{ isEnding ? '結束中…' : '結束直播' }}
    </button>
  </aside>
</template>
