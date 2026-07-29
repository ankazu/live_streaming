<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Room, RoomEvent, Track, type Room as LiveKitRoomInstance } from 'livekit-client'

import { getLiveKitToken } from '../api/livekit'
import { localVideoPreviewStyle } from './livekit-layout'

const props = withDefaults(
  defineProps<{ streamId: string; title: string; autoConnect?: boolean }>(),
  { autoConnect: false },
)
const room = ref<LiveKitRoomInstance>()
const isConnecting = ref(false)
const isConnected = ref(false)
const error = ref<string | null>(null)
const remoteVideoContainer = ref<HTMLDivElement>()
const localVideoContainer = ref<HTMLDivElement>()
const audioContainer = ref<HTMLDivElement>()

function attachTrack(track: Track, container: HTMLDivElement | undefined) {
  const element = track.attach()
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
    nextRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video) attachTrack(track, remoteVideoContainer.value)
      else attachTrack(track, audioContainer.value)
    })
    nextRoom.on(RoomEvent.TrackUnsubscribed, (track) => detachTrack(track))
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
      room.value = undefined
    })
    await nextRoom.connect(access.url, access.token)
    room.value = nextRoom
    isConnected.value = true
    if (access.canPublish) await nextRoom.localParticipant.enableCameraAndMicrophone()

    for (const participant of nextRoom.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track) attachTrack(publication.track, remoteVideoContainer.value)
      }
    }
  } catch (requestError: unknown) {
    error.value = getErrorMessage(requestError)
  } finally {
    isConnecting.value = false
  }
}

function disconnect() {
  room.value?.disconnect()
  remoteVideoContainer.value?.replaceChildren()
  localVideoContainer.value?.replaceChildren()
  audioContainer.value?.replaceChildren()
  room.value = undefined
  isConnected.value = false
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
    <div class="relative mt-4 min-h-48 overflow-hidden rounded-xl bg-black">
      <div ref="remoteVideoContainer" class="grid h-full min-h-48 w-full place-items-center" />
      <div
        ref="localVideoContainer"
        class="absolute right-3 bottom-3 z-10 overflow-hidden rounded-lg border-2 border-white/80 bg-black shadow-lg [&_video]:block [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        :style="localVideoPreviewStyle"
        aria-label="自己的鏡頭預覽"
      />
    </div>
    <div ref="audioContainer" class="sr-only" />
  </section>
</template>
