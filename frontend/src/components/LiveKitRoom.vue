<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Room, RoomEvent, Track, type Room as LiveKitRoomInstance } from 'livekit-client'

import { getLiveKitToken } from '../api/livekit'
import { useToast } from '../composables/useToast'
import { localVideoPreviewStyle, stageVideoClass } from '../lib/livekit-layout'

const props = withDefaults(
  defineProps<{
    streamId: string
    joinCode?: string
    autoConnect?: boolean
    stageParticipantId?: string
    canRequestStage?: boolean
    requestStageReady?: boolean
    requestStagePending?: boolean
    hasPendingStageRequest?: boolean
  }>(),
  { autoConnect: false },
)
const emit = defineEmits<{ left: []; requestStage: [] }>()
const room = ref<LiveKitRoomInstance>()
const isConnecting = ref(false)
const isConnected = ref(false)
const canPublish = ref(false)

const cameraEnabled = ref(false)
const microphoneEnabled = ref(false)
const showJoinCode = ref(Boolean(props.joinCode))
const isCodeCopied = ref(false)
const remoteVideoTrackCount = ref(0)
const remoteVideoContainer = ref<HTMLDivElement>()
const localVideoContainer = ref<HTMLDivElement>()
const audioContainer = ref<HTMLDivElement>()
const remoteTracks = new Map<string, Track>()
const remoteTrackElements = new Map<string, HTMLDivElement>()
let copyResetTimer: ReturnType<typeof setTimeout> | undefined
let isUnmounting = false
let disconnectRequested = false
const { showToast } = useToast()
const localVideoIsStage = computed(() =>
  Boolean(room.value && props.stageParticipantId === room.value.localParticipant.identity),
)

function attachTrack(
  track: Track,
  container: HTMLDivElement | undefined,
  participantIdentity?: string,
) {
  if (track.kind === Track.Kind.Video && participantIdentity) {
    const existing = remoteTrackElements.get(participantIdentity)
    if (existing) return
    const wrapper = document.createElement('div')
    wrapper.dataset.participantIdentity = participantIdentity
    wrapper.className = stageVideoClass(participantIdentity === props.stageParticipantId)
    const element = track.attach()
    element.classList.add('h-full', 'w-full', 'object-contain')
    wrapper.append(element)
    container?.append(wrapper)
    remoteTracks.set(participantIdentity, track)
    remoteTrackElements.set(participantIdentity, wrapper)
    remoteVideoTrackCount.value = remoteTracks.size
    return
  }
  const element = track.attach()
  container?.append(element)
}

function detachTrack(track: Track, participantIdentity?: string) {
  track.detach().forEach((element) => element.remove())
  if (participantIdentity) {
    remoteTrackElements.get(participantIdentity)?.remove()
    remoteTrackElements.delete(participantIdentity)
    remoteTracks.delete(participantIdentity)
    remoteVideoTrackCount.value = remoteTracks.size
  }
}

function updateRemoteLayout() {
  for (const [identity, element] of remoteTrackElements) {
    element.className = stageVideoClass(identity === props.stageParticipantId)
  }
}

function attachExistingRemoteTracks(nextRoom: LiveKitRoomInstance) {
  for (const participant of nextRoom.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (!publication.isSubscribed || !publication.track) continue
      if (publication.track.kind === Track.Kind.Video) {
        attachTrack(publication.track, remoteVideoContainer.value, participant.identity)
      }
    }
  }
}

async function connect() {
  isConnecting.value = true
  try {
    const access = await getLiveKitToken(props.streamId)
    canPublish.value = access.canPublish

    const nextRoom = new Room()
    nextRoom.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind === Track.Kind.Video)
        attachTrack(track, remoteVideoContainer.value, participant.identity)
      else attachTrack(track, audioContainer.value)
    })
    nextRoom.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) =>
      detachTrack(track, participant.identity),
    )
    nextRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.track) {
        const container =
          publication.track.kind === Track.Kind.Video
            ? localVideoContainer.value
            : audioContainer.value
        attachTrack(publication.track, container)
      }
    })
    nextRoom.on(RoomEvent.Disconnected, () => {
      isConnected.value = false
      canPublish.value = false
      cameraEnabled.value = false
      microphoneEnabled.value = false
      room.value = undefined
      if (!isUnmounting && !disconnectRequested) emit('left')
    })
    await nextRoom.connect(access.url, access.token)
    attachExistingRemoteTracks(nextRoom)
    room.value = nextRoom
    disconnectRequested = false
    isConnected.value = true
    if (access.canPublish) {
      await nextRoom.localParticipant.enableCameraAndMicrophone()
      cameraEnabled.value = true
      microphoneEnabled.value = true
    }
  } catch (requestError: unknown) {
    showToast(getErrorMessage(requestError), 'error')
  } finally {
    isConnecting.value = false
  }
}

function disconnect() {
  disconnectRequested = true
  room.value?.disconnect()
  remoteTracks.clear()
  remoteTrackElements.clear()
  remoteVideoContainer.value?.replaceChildren()
  localVideoContainer.value?.replaceChildren()
  audioContainer.value?.replaceChildren()
  room.value = undefined
  isConnected.value = false
  canPublish.value = false
  cameraEnabled.value = false
  microphoneEnabled.value = false
  remoteVideoTrackCount.value = 0
}

function leave() {
  disconnect()
  emit('left')
}

function showCode() {
  showJoinCode.value = true
}

function hideCode() {
  showJoinCode.value = false
}

async function copyJoinCode() {
  if (!props.joinCode || !navigator.clipboard) return

  try {
    await navigator.clipboard.writeText(props.joinCode)
    isCodeCopied.value = true
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      isCodeCopied.value = false
    }, 2000)
  } catch {
    showToast('目前無法複製直播代碼，請稍後再試。', 'error')
  }
}

async function toggleCamera() {
  if (!room.value || !canPublish.value) return

  try {
    await room.value.localParticipant.setCameraEnabled(!cameraEnabled.value)
    cameraEnabled.value = !cameraEnabled.value
  } catch {
    showToast('目前無法切換鏡頭，請稍後再試。', 'error')
  }
}

async function toggleMicrophone() {
  if (!room.value || !canPublish.value) return

  try {
    await room.value.localParticipant.setMicrophoneEnabled(!microphoneEnabled.value)
    microphoneEnabled.value = !microphoneEnabled.value
  } catch {
    showToast('目前無法切換麥克風，請稍後再試。', 'error')
  }
}

function getErrorMessage(requestError: unknown) {
  if (typeof requestError === 'object' && requestError !== null && 'response' in requestError) {
    const response = (requestError as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return '目前無法連線到直播，請稍後再試。'
}

onMounted(() => {
  if (props.autoConnect) connect()
})
watch(() => props.stageParticipantId, updateRemoteLayout)
onBeforeUnmount(() => {
  isUnmounting = true
  if (copyResetTimer) clearTimeout(copyResetTimer)
  disconnect()
})
</script>

<template>
  <section class="bg-ink min-w-0 rounded-2xl p-5 text-white">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <p class="eyebrow text-white/60">LIVE ROOM</p>
        <button
          v-if="props.joinCode"
          data-testid="live-code-toggle"
          class="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
          type="button"
          aria-label="重新顯示直播代碼"
          title="重新顯示直播代碼"
          @click="showCode"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" />
            <path d="M8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8zM13 13h3v3h-3z" />
          </svg>
        </button>
      </div>
      <button
        v-if="props.canRequestStage && isConnected"
        data-testid="participant-request"
        class="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
        type="button"
        :disabled="props.requestStagePending || props.hasPendingStageRequest"
        @click="emit('requestStage')"
      >
        {{
          props.requestStagePending
            ? '申請中…'
            : props.hasPendingStageRequest
              ? '等待主播同意'
              : '申請上台'
        }}
      </button>
      <button
        v-if="!props.autoConnect && !isConnected"
        class="bg-coral rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
        :disabled="isConnecting"
        @click="connect"
      >
        {{ isConnecting ? '連線中…' : '加入直播' }}
      </button>
      <button
        v-else-if="isConnected"
        class="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold"
        @click="leave"
      >
        離開直播
      </button>
    </div>

    <div
      data-testid="live-video-surface"
      class="group relative mt-4 aspect-video min-h-48 w-full overflow-hidden rounded-xl bg-black"
    >
      <div
        v-if="props.joinCode && showJoinCode"
        data-testid="live-code-popup"
        class="absolute bottom-20 left-3 z-20 w-44 rounded-xl border border-white/15 bg-[#2b2733]/95 p-3 shadow-xl backdrop-blur"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-white/60">直播代碼</p>
          <button
            data-testid="live-code-close"
            class="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
            type="button"
            aria-label="關閉直播代碼"
            @click="hideCode"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="mt-1 flex items-center gap-2">
          <p class="font-mono text-2xl font-semibold tracking-[4px] text-white">
            {{ props.joinCode }}
          </p>
          <button
            data-testid="live-code-copy"
            class="rounded-md p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
            type="button"
            :aria-label="isCodeCopied ? '已複製直播代碼' : '複製直播代碼'"
            :title="isCodeCopied ? '已複製直播代碼' : '複製直播代碼'"
            @click="copyJoinCode"
          >
            <svg
              v-if="!isCodeCopied"
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              class="h-4 w-4 text-emerald-300"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </button>
        </div>
      </div>
      <div
        v-if="remoteVideoTrackCount === 0"
        data-testid="live-default-state"
        class="pointer-events-none absolute inset-0 grid place-items-center text-center text-white/50"
      >
        <div>
          <div class="text-5xl text-white/25">◉</div>
          <p class="mt-3 text-sm">等待直播畫面</p>
        </div>
      </div>
      <div
        ref="remoteVideoContainer"
        data-testid="remote-video-container"
        class="absolute inset-0 grid h-full w-full place-items-center [&_video]:block [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
      />
      <div
        v-if="canPublish"
        ref="localVideoContainer"
        data-testid="local-video-container"
        class="absolute overflow-hidden border-2 border-white/80 bg-black shadow-lg [&_video]:block [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        :class="
          localVideoIsStage
            ? 'inset-0 z-0 rounded-none [&_video]:object-contain'
            : 'right-3 bottom-3 z-10 rounded-lg'
        "
        :style="localVideoIsStage ? undefined : localVideoPreviewStyle"
        aria-label="自己的鏡頭預覽"
      />
      <div
        v-if="isConnected && canPublish"
        class="pointer-events-none absolute bottom-3 left-3 z-10 flex gap-2 rounded-full bg-black/60 p-1.5 opacity-0 backdrop-blur transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
        aria-label="直播媒體控制"
      >
        <button
          data-testid="live-toggle-camera"
          class="rounded-full p-2 text-white transition hover:bg-white/20"
          :class="cameraEnabled ? 'bg-white/15' : 'bg-coral'"
          :aria-pressed="cameraEnabled"
          :aria-label="cameraEnabled ? '關閉鏡頭' : '開啟鏡頭'"
          :title="cameraEnabled ? '關閉鏡頭' : '開啟鏡頭'"
          @click="toggleCamera"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M4 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
            <path d="m17 10 5-3v10l-5-3z" />
            <path v-if="!cameraEnabled" d="m3 3 18 18" />
          </svg>
        </button>
        <button
          data-testid="live-toggle-microphone"
          class="rounded-full p-2 text-white transition hover:bg-white/20"
          :class="microphoneEnabled ? 'bg-white/15' : 'bg-coral'"
          :aria-pressed="microphoneEnabled"
          :aria-label="microphoneEnabled ? '關閉麥克風' : '開啟麥克風'"
          :title="microphoneEnabled ? '關閉麥克風' : '開啟麥克風'"
          @click="toggleMicrophone"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <rect x="8" y="3" width="8" height="12" rx="4" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
            <path v-if="!microphoneEnabled" d="m3 3 18 18" />
          </svg>
        </button>
      </div>
    </div>
    <div ref="audioContainer" class="sr-only" />
  </section>
</template>
