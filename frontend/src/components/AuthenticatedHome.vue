<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import BroadcasterStudio from './BroadcasterStudio.vue'
import CameraPreview from './CameraPreview.vue'
import ChatWindow from './ChatWindow.vue'
import JoinStreamForm from './JoinStreamForm.vue'
import LiveKitRoom from './LiveKitRoom.vue'
import SiteHeader from './SiteHeader.vue'
import { endStream, getStreamByJoinCode } from '../api/streams'
import { useToast } from '../composables/useToast'
import {
  clearWorkspaceSession,
  readWorkspaceSession,
  writeWorkspaceSession,
} from '../lib/workspace-session'
import type { Stream } from '../types/stream'
import { useAuthStore } from '../stores/auth/store'

const auth = useAuthStore()
const savedWorkspace = readWorkspaceSession()
const activeStream = ref<Stream | null>(
  savedWorkspace?.mode === 'host' ? savedWorkspace.stream : null,
)
const viewerStream = ref<Stream | null>(
  savedWorkspace?.mode === 'viewer' ? savedWorkspace.stream : null,
)
const currentStream = computed(() => activeStream.value ?? viewerStream.value)
const isCurrentUserHost = computed(() =>
  Boolean(currentStream.value && auth.user?.id === currentStream.value.ownerId),
)
const liveRoomRevision = ref(0)
const stageParticipantId = ref<string>()
const participantRole = ref<'viewer' | 'guest'>('viewer')
const isChatReady = ref(false)
const chatWindow = ref<InstanceType<typeof ChatWindow> | null>(null)
const { showToast } = useToast()
const canRequestStage = computed(
  () => !isCurrentUserHost.value && participantRole.value === 'viewer',
)
const requestStagePending = computed(() => chatWindow.value?.isRequestPending ?? false)
const hasPendingStageRequest = computed(() => chatWindow.value?.hasPendingStageRequest ?? false)
const pendingStageRequests = computed(() => chatWindow.value?.pendingStageRequests ?? [])
const stageGuests = computed(() => chatWindow.value?.stageGuests ?? [])
const canLeaveStage = computed(() => !isCurrentUserHost.value && participantRole.value === 'guest')

function handleLiveCreated(stream: Stream) {
  activeStream.value = stream
  viewerStream.value = null
  stageParticipantId.value = auth.user?.id
}

function handleLiveEnded() {
  activeStream.value = null
  viewerStream.value = null
  stageParticipantId.value = undefined
  participantRole.value = 'viewer'
  isChatReady.value = false
}

function handleWatchLive(stream: Stream) {
  viewerStream.value = stream
}

async function handleLiveLeft() {
  const stream = currentStream.value
  if (stream && isCurrentUserHost.value) {
    try {
      await endStream(stream.id)
    } catch {
      showToast('目前無法結束直播，請稍後再試。', 'error')
      return
    }
  }
  activeStream.value = null
  viewerStream.value = null
  stageParticipantId.value = undefined
  participantRole.value = 'viewer'
  isChatReady.value = false
}

function handleParticipantRoleChanged(role: 'viewer' | 'guest') {
  participantRole.value = role
  liveRoomRevision.value += 1
}

function handleRequestStage() {
  chatWindow.value?.requestToJoin()
}

function handleModerateStageRequest(action: 'approve' | 'reject', requestId: string) {
  chatWindow.value?.moderateRequest(`participant:${action}`, requestId)
}

function handleRemoveGuest(userId: string) {
  chatWindow.value?.removeGuest(userId)
}

function handleLeaveStage() {
  chatWindow.value?.leaveStage()
}

function handleStageChanged(participantId: string) {
  stageParticipantId.value = participantId
}

async function restoreWorkspace() {
  if (!savedWorkspace) return

  try {
    const stream = await getStreamByJoinCode(savedWorkspace.stream.joinCode)
    if (savedWorkspace.mode === 'host') {
      if (stream.ownerId !== auth.user?.id) {
        handleLiveLeft()
        return
      }
      handleLiveCreated(stream)
      return
    }
    handleWatchLive(stream)
  } catch {
    handleLiveLeft()
  }
}

watch([activeStream, viewerStream], ([nextActiveStream, nextViewerStream]) => {
  const stream = nextActiveStream ?? nextViewerStream
  if (!stream) {
    clearWorkspaceSession()
    return
  }
  writeWorkspaceSession(sessionStorage, nextActiveStream ? 'host' : 'viewer', stream)
})

onMounted(restoreWorkspace)
</script>

<template>
  <main class="mx-auto max-w-[1280px] overflow-hidden px-6 sm:px-14">
    <SiteHeader dashboard />
    <!-- <section class="border-b border-[#e5e0da] py-10 sm:py-14">
      <div class="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p class="eyebrow">YOUR LIVE DESK</p>
          <h1
            class="font-display text-ink mt-2 text-4xl font-semibold tracking-[-1.5px] sm:text-5xl"
          >
            嗨，{{ auth.user?.displayName }}
          </h1>
          <p class="text-muted mt-3">今天想分享什麼？先從鏡頭預覽開始。</p>
        </div>
      </div>
    </section> -->

    <section
      data-testid="workspace-grid"
      class="grid items-start gap-8 py-10 lg:grid-cols-[1.35fr_0.65fr]"
      :class="{ 'lg:items-stretch': currentStream }"
    >
      <LiveKitRoom
        v-if="currentStream"
        :key="`live-room-${currentStream.id}-${liveRoomRevision}`"
        :stream-id="currentStream.id"
        :join-code="activeStream?.joinCode"
        :stage-participant-id="stageParticipantId"
        :can-request-stage="canRequestStage"
        :request-stage-ready="isChatReady"
        :request-stage-pending="requestStagePending"
        :has-pending-stage-request="hasPendingStageRequest"
        :pending-stage-requests="isCurrentUserHost ? pendingStageRequests : []"
        :stage-guests="isCurrentUserHost ? stageGuests : []"
        :host-participant-id="currentStream.ownerId"
        :host-participant-name="isCurrentUserHost ? auth.user?.displayName : undefined"
        :can-leave-stage="canLeaveStage"
        :auto-connect="Boolean(activeStream || viewerStream)"
        @left="handleLiveLeft"
        @request-stage="handleRequestStage"
        @moderate-stage-request="handleModerateStageRequest"
        @remove-guest="handleRemoveGuest"
        @leave-stage="handleLeaveStage"
      />
      <CameraPreview v-else />

      <div
        data-testid="workspace-right"
        class="flex min-w-0 flex-col gap-6"
        :class="currentStream ? 'h-full min-h-0' : ''"
      >
        <BroadcasterStudio
          v-if="!activeStream && !viewerStream"
          :active-stream="activeStream"
          @live-created="handleLiveCreated"
        />
        <ChatWindow
          ref="chatWindow"
          v-if="currentStream"
          :key="`chat-${currentStream.id}`"
          :stream-id="currentStream.id"
          :user-id="auth.user?.id"
          :can-moderate="isCurrentUserHost"
          @ended="handleLiveEnded"
          @role-changed="handleParticipantRoleChanged"
          @stage-changed="handleStageChanged"
          @chat-ready="isChatReady = $event"
        />
        <JoinStreamForm v-if="!activeStream && !viewerStream" @watch-live="handleWatchLive" />
      </div>
    </section>

    <section class="border-t border-[#e5e0da] py-10 pb-20">
      <p class="eyebrow">QUICK START</p>
      <h2 class="font-display text-ink mt-3 text-3xl font-semibold">三步開始你的直播</h2>
      <div class="text-muted mt-6 grid gap-5 text-sm leading-6 sm:grid-cols-3">
        <p><strong class="text-ink">01</strong><br />開啟鏡頭，確認畫面與光線。</p>
        <p><strong class="text-ink">02</strong><br />主播開始直播，取得 6 位數直播代碼。</p>
        <p><strong class="text-ink">03</strong><br />觀眾輸入代碼，進入即時互動。</p>
      </div>
    </section>
  </main>
</template>
