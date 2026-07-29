<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { Room, RoomEvent, Track, type Room as LiveKitRoomInstance } from 'livekit-client'

import { getLiveKitToken } from '../api/livekit'

const props = defineProps<{ streamId: string; title: string }>()
const room = ref<LiveKitRoomInstance>()
const socket = ref<Socket>()
const isConnecting = ref(false)
const isConnected = ref(false)
const isChatJoined = ref(false)
const error = ref<string | null>(null)
const videoContainer = ref<HTMLDivElement>()
const audioContainer = ref<HTMLDivElement>()
const chatInput = ref('')
const presenceCount = ref(0)
const messages = ref<Array<{ id: string; displayName: string; content: string }>>([])
let heartbeatTimer: ReturnType<typeof setInterval> | undefined

function attachTrack(track: Track) {
  const element = track.attach()
  const container = track.kind === Track.Kind.Video ? videoContainer.value : audioContainer.value
  container?.append(element)
}

function detachTrack(track: Track) {
  track.detach().forEach((element) => element.remove())
}

async function connect() {
  isConnecting.value = true
  error.value = null
  try {
    const access = await getLiveKitToken(props.streamId)
    const nextRoom = new Room()
    nextRoom.on(RoomEvent.TrackSubscribed, (track) => attachTrack(track))
    nextRoom.on(RoomEvent.TrackUnsubscribed, (track) => detachTrack(track))
    nextRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.track) attachTrack(publication.track)
    })
    nextRoom.on(RoomEvent.Disconnected, () => {
      disconnectChat()
      isConnected.value = false
      room.value = undefined
    })
    await nextRoom.connect(access.url, access.token)
    room.value = nextRoom
    isConnected.value = true
    if (access.canPublish) await nextRoom.localParticipant.enableCameraAndMicrophone()

    for (const participant of nextRoom.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track) attachTrack(publication.track)
      }
    }
    connectChat()
  } catch (requestError: unknown) {
    error.value = getErrorMessage(requestError)
  } finally {
    isConnecting.value = false
  }
}

function connectChat() {
  const token = localStorage.getItem('live-streaming.access-token')
  if (!token) return
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
  const chatSocket = io(apiBaseUrl.replace(/\/api\/?$/, ''), { auth: { token } })
  socket.value = chatSocket
  chatSocket.on('connect', () => {
    chatSocket.emit(
      'stream:join',
      props.streamId,
      (result: { success: boolean; viewerCount?: number }) => {
        if (result.success && result.viewerCount !== undefined) {
          isChatJoined.value = true
          presenceCount.value = result.viewerCount
          return
        }
        error.value = '聊天室加入直播間失敗。'
        disconnectChat()
      },
    )
  })
  chatSocket.on('chat:message', (message: { id: string; displayName: string; content: string }) => {
    messages.value.push(message)
  })
  chatSocket.on(
    'presence:count',
    (data: { viewerCount: number }) => (presenceCount.value = data.viewerCount),
  )
  chatSocket.on('connect_error', () => (error.value = '聊天室暫時無法連線。'))
  heartbeatTimer = setInterval(() => chatSocket.emit('presence:heartbeat'), 15_000)
}

function sendChatMessage() {
  const content = chatInput.value.trim()
  if (!content || !socket.value?.connected || !isChatJoined.value) return
  socket.value.emit('chat:send', content, (result: { success: boolean; code?: string }) => {
    if (!result.success) {
      error.value = result.code === 'RATE_LIMITED' ? '留言太頻繁，請稍後再試。' : '留言未送出。'
      return
    }
    chatInput.value = ''
  })
}

function disconnectChat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = undefined
  socket.value?.emit('stream:leave')
  socket.value?.disconnect()
  socket.value = undefined
  isChatJoined.value = false
}

function disconnect() {
  disconnectChat()
  room.value?.disconnect()
  videoContainer.value?.replaceChildren()
  audioContainer.value?.replaceChildren()
  room.value = undefined
  isConnected.value = false
  messages.value = []
  presenceCount.value = 0
}

function getErrorMessage(requestError: unknown) {
  if (typeof requestError === 'object' && requestError !== null && 'response' in requestError) {
    const response = (requestError as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return '目前無法連線到直播，請稍後再試。'
}

onUnmounted(disconnect)
</script>

<template>
  <section class="bg-ink mt-8 rounded-2xl p-5 text-white">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="eyebrow text-white/60">LIVE ROOM</p>
        <h3 class="mt-1 text-xl font-semibold">{{ title }}</h3>
      </div>
      <button
        v-if="!isConnected"
        class="bg-coral rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
        :disabled="isConnecting"
        @click="connect"
      >
        {{ isConnecting ? 'Connecting…' : 'Join live' }}
      </button>
      <button
        v-else
        class="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold"
        @click="disconnect"
      >
        Leave
      </button>
    </div>
    <p v-if="error" class="text-coral mt-3 text-sm">{{ error }}</p>
    <div
      ref="videoContainer"
      class="mt-4 grid min-h-48 place-items-center overflow-hidden rounded-xl bg-black"
    />
    <div ref="audioContainer" class="sr-only" />
    <div v-if="isConnected" class="mt-4 rounded-xl bg-white/10 p-4">
      <div class="mb-3 flex items-center justify-between text-xs text-white/60">
        <span>聊天室</span><span>{{ presenceCount }} 人在線</span>
      </div>
      <div class="mb-3 max-h-40 space-y-2 overflow-y-auto text-sm">
        <p v-for="message in messages" :key="message.id">
          <strong class="text-coral">{{ message.displayName }}</strong> {{ message.content }}
        </p>
        <p v-if="messages.length === 0" class="text-white/50">成為第一個留言的人。</p>
      </div>
      <form class="flex gap-2" @submit.prevent="sendChatMessage">
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
    </div>
  </section>
</template>
