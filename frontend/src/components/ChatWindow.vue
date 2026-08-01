<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

import { useToast } from '../composables/useToast'

const props = defineProps<{ streamId: string; userId?: string; canModerate?: boolean }>()
const emit = defineEmits<{
  ended: []
  roleChanged: [role: 'viewer' | 'guest']
  stageChanged: [participantId: string]
  chatReady: [ready: boolean]
}>()

type ChatMessage = { id: string; displayName: string; content: string }
type ParticipantRequest = { id: string; userId: string; displayName: string }
type Participant = { userId: string; displayName: string; role: 'host' | 'viewer' | 'guest' }

const socket = ref<Socket>()
const isJoined = ref(false)
const chatInput = ref('')
const presenceCount = ref(0)
const messages = ref<ChatMessage[]>([])
const participantRole = ref<'viewer' | 'guest'>('viewer')
const pendingRequests = ref<ParticipantRequest[]>([])
const guests = ref<Participant[]>([])
const requestPending = ref(false)
const hasPendingStageRequest = ref(false)
const stageParticipantId = ref(props.userId)
const isChatReady = computed(() => Boolean(socket.value?.connected && isJoined.value))
const { showToast } = useToast()
let heartbeatTimer: ReturnType<typeof setInterval> | undefined

function connectChat() {
  const token = localStorage.getItem('live-streaming.access-token')
  if (!token) {
    showToast('登入狀態已失效，無法開啟聊天室。', 'error')
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
          emit('chatReady', true)
          return
        }
        showToast('聊天室加入直播間失敗。', 'error')
        disconnect()
      },
    )
  })
  chatSocket.on('chat:message', (message: ChatMessage) => messages.value.push(message))
  chatSocket.on('participant:requests', (requests: ParticipantRequest[]) => {
    pendingRequests.value = requests
    hasPendingStageRequest.value = Boolean(
      props.userId && requests.some((request) => request.userId === props.userId),
    )
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
      hasPendingStageRequest.value = false
      participantRole.value = 'guest'
      emit('roleChanged', 'guest')
    }
  })
  chatSocket.on('participant:rejected', (request: ParticipantRequest) => {
    pendingRequests.value = pendingRequests.value.filter((item) => item.id !== request.id)
    if (request.userId === props.userId) {
      hasPendingStageRequest.value = false
      showToast('主播已拒絕你的上台申請。', 'error')
    }
  })
  chatSocket.on('participant:removed', (participant: Participant) => {
    guests.value = guests.value.filter((guest) => guest.userId !== participant.userId)
    if (participant.userId === props.userId) {
      participantRole.value = 'viewer'
      showToast('你已回到觀眾席。', 'info')
      emit('roleChanged', 'viewer')
    } else if (props.canModerate && participant.role === 'viewer') {
      showToast(`${participant.displayName} 已離開舞台。`, 'info')
    }
  })
  chatSocket.on('stage:changed', ({ participantId }: { participantId: string }) => {
    stageParticipantId.value = participantId
    emit('stageChanged', participantId)
  })
  chatSocket.on('stream:ended', ({ streamId }: { streamId: string }) => {
    if (streamId !== props.streamId) return
    showToast('直播已結束。', 'info')
    disconnect()
    emit('ended')
  })
  chatSocket.on(
    'stream:participant-left',
    ({ displayName, role }: { displayName: string; role: string }) => {
      if (role === 'viewer') showToast(`${displayName} 已離開直播。`, 'info')
    },
  )
  chatSocket.on('presence:count', (data: { viewerCount: number }) => {
    presenceCount.value = data.viewerCount
  })
  chatSocket.on('connect_error', () => showToast('聊天室暫時無法連線。', 'error'))
  heartbeatTimer = setInterval(() => chatSocket.emit('presence:heartbeat'), 15_000)
}

function sendMessage() {
  const content = chatInput.value.trim()
  if (!content || !socket.value?.connected || !isJoined.value) return

  socket.value.emit('chat:send', content, (result: { success: boolean; code?: string }) => {
    if (!result.success) {
      showToast(
        result.code === 'RATE_LIMITED' ? '留言太頻繁，請稍後再試。' : '留言未送出。',
        'error',
      )
      return
    }
    chatInput.value = ''
  })
}

function requestToJoin() {
  if (!socket.value?.connected || !isJoined.value) {
    showToast('聊天室仍在連線中，請稍候再試。', 'error')
    return
  }
  if (requestPending.value || hasPendingStageRequest.value) return
  requestPending.value = true
  socket.value.emit('participant:request', (result: { success: boolean; code?: string }) => {
    requestPending.value = false
    if (result.success || result.code === 'REQUEST_ALREADY_PENDING') {
      hasPendingStageRequest.value = true
    }
    showToast(
      result.success
        ? '申請中，等待主播同意。'
        : result.code === 'REQUEST_ALREADY_PENDING'
          ? '你已經送出過申請，請等待主播同意。'
          : result.code === 'REQUEST_COOLDOWN'
            ? '申請太頻繁，請稍後再試。'
            : '目前無法申請上台。',
      result.success ||
        result.code === 'REQUEST_ALREADY_PENDING' ||
        result.code === 'REQUEST_COOLDOWN'
        ? 'info'
        : 'error',
    )
  })
}

function moderate(event: 'participant:approve' | 'participant:reject', requestId: string) {
  socket.value?.emit(event, requestId, (result: { success: boolean }) => {
    if (!result.success) showToast('目前無法處理上台申請。', 'error')
  })
}

function removeGuest(userId: string) {
  socket.value?.emit('participant:remove', userId, (result: { success: boolean }) => {
    if (!result.success) showToast('目前無法移除來賓。', 'error')
  })
}

function changeStage(participantId: string) {
  socket.value?.emit('stage:change', participantId, (result: { success: boolean }) => {
    if (!result.success) {
      showToast('目前無法切換舞台畫面。', 'error')
      return
    }
    stageParticipantId.value = participantId
    emit('stageChanged', participantId)
  })
}

function leaveStage() {
  socket.value?.emit('participant:leave-stage', (result: { success: boolean }) => {
    if (!result.success) showToast('目前無法下舞台，請稍後再試。', 'error')
  })
}

function disconnect() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = undefined
  socket.value?.emit('stream:leave')
  socket.value?.disconnect()
  socket.value = undefined
  isJoined.value = false
  emit('chatReady', false)
}

defineExpose({
  hasPendingStageRequest: computed(() => hasPendingStageRequest.value),
  isRequestPending: computed(() => requestPending.value || hasPendingStageRequest.value),
  isChatReady,
  pendingStageRequests: computed(() => pendingRequests.value),
  moderateRequest: moderate,
  requestToJoin,
})

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
