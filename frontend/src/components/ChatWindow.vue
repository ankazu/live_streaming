<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

const props = defineProps<{ streamId: string; userId?: string; canModerate?: boolean }>()
const emit = defineEmits<{
  ended: []
  roleChanged: [role: 'viewer' | 'guest']
  stageChanged: [participantId: string]
}>()

type ChatMessage = { id: string; displayName: string; content: string }
type ParticipantRequest = { id: string; userId: string; displayName: string }
type Participant = { userId: string; displayName: string; role: 'host' | 'viewer' | 'guest' }

const socket = ref<Socket>()
const isJoined = ref(false)
const error = ref<string | null>(null)
const chatInput = ref('')
const presenceCount = ref(0)
const messages = ref<ChatMessage[]>([])
const participantRole = ref<'viewer' | 'guest'>('viewer')
const pendingRequests = ref<ParticipantRequest[]>([])
const guests = ref<Participant[]>([])
const requestPending = ref(false)
const stageParticipantId = ref(props.userId)
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
      (result: { success: boolean; viewerCount?: number; code?: string }) => {
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
  chatSocket.on('participant:requests', (requests: ParticipantRequest[]) => {
    pendingRequests.value = requests
  })
  chatSocket.on('participant:request-created', (request: ParticipantRequest) => {
    if (props.canModerate && !pendingRequests.value.some((item) => item.id === request.id)) {
      pendingRequests.value.push(request)
    }
  })
  chatSocket.on('participant:approved', ({ participant }: { participant: Participant }) => {
    pendingRequests.value = pendingRequests.value.filter(
      (request) => request.userId !== participant.userId,
    )
    if (participant.role !== 'guest') return
    guests.value = [
      ...guests.value.filter((guest) => guest.userId !== participant.userId),
      participant,
    ]
    if (participant.userId === props.userId) {
      participantRole.value = 'guest'
      emit('roleChanged', 'guest')
    }
  })
  chatSocket.on('participant:rejected', (request: ParticipantRequest) => {
    pendingRequests.value = pendingRequests.value.filter((item) => item.id !== request.id)
    if (request.userId === props.userId) error.value = '主播已拒絕你的上台申請。'
  })
  chatSocket.on('participant:removed', (participant: Participant) => {
    guests.value = guests.value.filter((guest) => guest.userId !== participant.userId)
    if (participant.userId === props.userId) {
      participantRole.value = 'viewer'
      error.value = '你已回到觀眾席。'
      emit('roleChanged', 'viewer')
    }
  })
  chatSocket.on('stage:changed', ({ participantId }: { participantId: string }) => {
    stageParticipantId.value = participantId
    emit('stageChanged', participantId)
  })
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

function requestToJoin() {
  if (!socket.value?.connected || !isJoined.value || requestPending.value) return
  requestPending.value = true
  socket.value.emit('participant:request', (result: { success: boolean; code?: string }) => {
    requestPending.value = false
    error.value = result.success
      ? '已送出上台申請，等待主播同意。'
      : result.code === 'REQUEST_ALREADY_PENDING'
        ? '你已經送出過申請。'
        : '目前無法申請上台。'
  })
}

function moderate(event: 'participant:approve' | 'participant:reject', requestId: string) {
  socket.value?.emit(event, requestId, (result: { success: boolean }) => {
    if (!result.success) error.value = '目前無法處理上台申請。'
  })
}

function removeGuest(userId: string) {
  socket.value?.emit('participant:remove', userId, (result: { success: boolean }) => {
    if (!result.success) error.value = '目前無法移除來賓。'
  })
}

function changeStage(participantId: string) {
  socket.value?.emit('stage:change', participantId, (result: { success: boolean }) => {
    if (!result.success) {
      error.value = '目前無法切換舞台畫面。'
      return
    }
    stageParticipantId.value = participantId
    emit('stageChanged', participantId)
  })
}

function leaveStage() {
  socket.value?.emit('participant:leave-stage', (result: { success: boolean }) => {
    if (!result.success) error.value = '目前無法下舞台，請稍後再試。'
  })
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
  <aside
    class="bg-ink flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl p-5 text-white sm:p-6"
  >
    <div class="flex items-start justify-between gap-3">
      <p class="eyebrow text-white/60">LIVE CHAT</p>
      <span class="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
        {{ presenceCount }} 人在線
      </span>
    </div>
    <p v-if="error" class="text-coral mt-3 text-sm" role="alert">{{ error }}</p>
    <div v-if="!props.canModerate && participantRole === 'viewer'" class="mt-4">
      <button
        data-testid="participant-request"
        class="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
        type="button"
        :disabled="requestPending"
        @click="requestToJoin"
      >
        {{ requestPending ? '申請中…' : '申請上台' }}
      </button>
    </div>
    <div
      v-if="props.canModerate && pendingRequests.length"
      class="mt-4 space-y-2 rounded-2xl bg-white/5 p-3"
    >
      <p class="text-xs font-semibold text-white/60">上台申請</p>
      <div
        v-for="request in pendingRequests"
        :key="request.id"
        class="flex items-center justify-between gap-2 text-sm"
      >
        <span class="min-w-0 truncate">{{ request.displayName }}</span>
        <div class="flex shrink-0 gap-2">
          <button
            class="bg-coral rounded-full px-3 py-1 text-xs font-semibold"
            type="button"
            @click="moderate('participant:approve', request.id)"
          >
            同意上台
          </button>
          <button
            class="rounded-full bg-white/10 px-3 py-1 text-xs"
            type="button"
            @click="moderate('participant:reject', request.id)"
          >
            拒絕
          </button>
        </div>
      </div>
    </div>
    <div v-if="props.canModerate && guests.length" class="mt-3 space-y-2">
      <div class="flex flex-wrap items-center gap-2 text-xs text-white/70">
        <span>主畫面：</span>
        <button
          class="rounded-full px-3 py-1"
          :class="stageParticipantId === props.userId ? 'bg-coral text-white' : 'bg-white/10'"
          type="button"
          @click="props.userId && changeStage(props.userId)"
        >
          主播
        </button>
        <button
          v-for="guest in guests"
          :key="`stage-${guest.userId}`"
          class="rounded-full px-3 py-1"
          :class="stageParticipantId === guest.userId ? 'bg-coral text-white' : 'bg-white/10'"
          type="button"
          @click="changeStage(guest.userId)"
        >
          {{ guest.displayName }}
        </button>
      </div>
      <div
        v-for="guest in guests"
        :key="guest.userId"
        class="flex items-center justify-between gap-2 text-xs text-white/70"
      >
        <span class="truncate">舞台來賓：{{ guest.displayName }}</span>
        <button
          class="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20"
          type="button"
          @click="removeGuest(guest.userId)"
        >
          移除來賓
        </button>
      </div>
    </div>
    <div v-if="!props.canModerate && participantRole === 'guest'" class="mt-4">
      <button
        data-testid="participant-leave-stage"
        class="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
        type="button"
        @click="leaveStage"
      >
        下舞台
      </button>
    </div>
    <div class="mt-5 max-h-[353px] min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto text-sm">
      <p v-for="message in messages" :key="message.id" class="break-words">
        <strong class="text-coral">{{ message.displayName }}</strong> {{ message.content }}
      </p>
      <!-- <p v-if="messages.length === 0" class="text-white/50">成為第一個留言的人。</p> -->
    </div>
    <form class="mt-5 flex gap-2" @submit.prevent="sendMessage">
      <input
        v-model="chatInput"
        class="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none placeholder:text-white/40"
        maxlength="500"
        placeholder="說點什麼…"
      />
      <button class="bg-coral rounded-full px-4 py-2 text-sm font-semibold" type="submit">
        發送
      </button>
    </form>
  </aside>
</template>
