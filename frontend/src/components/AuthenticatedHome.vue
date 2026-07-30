<script setup lang="ts">
import { computed, ref } from 'vue'

import BroadcasterStudio from './BroadcasterStudio.vue'
import CameraPreview from './CameraPreview.vue'
import ChatWindow from './ChatWindow.vue'
import JoinStreamForm from './JoinStreamForm.vue'
import LiveKitRoom from './LiveKitRoom.vue'
import SiteHeader from './SiteHeader.vue'
import type { Stream } from '../types/stream'
import { useAuthStore } from '../stores/auth/store'

const auth = useAuthStore()
const activeStream = ref<Stream | null>(null)
const viewerStream = ref<Stream | null>(null)
const currentStream = computed(() => activeStream.value ?? viewerStream.value)
const isCurrentUserHost = computed(() =>
  Boolean(currentStream.value && auth.user?.id === currentStream.value.ownerId),
)
const liveRoomRevision = ref(0)
const stageParticipantId = ref<string>()

function handleLiveCreated(stream: Stream) {
  activeStream.value = stream
  viewerStream.value = null
  stageParticipantId.value = auth.user?.id
}

function handleLiveEnded() {
  activeStream.value = null
  viewerStream.value = null
  stageParticipantId.value = undefined
}

function handleWatchLive(stream: Stream) {
  viewerStream.value = stream
}

function handleLiveLeft() {
  activeStream.value = null
  viewerStream.value = null
  stageParticipantId.value = undefined
}

function handleParticipantRoleChanged() {
  liveRoomRevision.value += 1
}

function handleStageChanged(participantId: string) {
  stageParticipantId.value = participantId
}
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
        :auto-connect="Boolean(activeStream || viewerStream)"
        @left="handleLiveLeft"
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
          v-if="currentStream"
          :key="`chat-${currentStream.id}`"
          :stream-id="currentStream.id"
          :user-id="auth.user?.id"
          :can-moderate="isCurrentUserHost"
          @ended="handleLiveEnded"
          @role-changed="handleParticipantRoleChanged"
          @stage-changed="handleStageChanged"
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
