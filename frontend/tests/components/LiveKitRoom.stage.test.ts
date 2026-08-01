import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rooms, FakeRoom } = vi.hoisted(() => {
  const rooms: any[] = []
  class FakeRoom {
    localParticipant = { identity: 'viewer' }
    remoteParticipants = new Map()
    private handlers = new Map<string, (...args: unknown[]) => void>()

    constructor() {
      rooms.push(this)
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      this.handlers.set(event, handler)
      return this
    }

    async connect() {}

    disconnect() {}

    emitEvent(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args)
    }
  }
  return { rooms, FakeRoom }
})

vi.mock('livekit-client', () => ({
  Room: FakeRoom,
  RoomEvent: {
    TrackSubscribed: 'TrackSubscribed',
    TrackUnsubscribed: 'TrackUnsubscribed',
    LocalTrackPublished: 'LocalTrackPublished',
    Disconnected: 'Disconnected',
  },
  Track: { Kind: { Video: 'video', Audio: 'audio' } },
}))

vi.mock('../../src/api/livekit', () => ({
  getLiveKitToken: vi.fn().mockResolvedValue({
    url: 'wss://livekit.test',
    token: 'test-token',
    canPublish: false,
  }),
}))

import LiveKitRoom from '../../src/components/LiveKitRoom.vue'
import { mount } from '@vue/test-utils'

function createVideoTrack() {
  const element = document.createElement('video')
  return {
    kind: 'video',
    attach: vi.fn(() => element),
    detach: vi.fn(() => [element]),
  }
}

describe('LiveKitRoom stage rendering', () => {
  beforeEach(() => {
    rooms.length = 0
  })

  it('renders only the selected remote participant and switches it on stage change', async () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1', autoConnect: true, stageParticipantId: 'host' },
    })
    await nextTick()

    const room = rooms[0]
    room.emitEvent('TrackSubscribed', createVideoTrack(), {}, { identity: 'host' })
    room.emitEvent('TrackSubscribed', createVideoTrack(), {}, { identity: 'guest' })
    await nextTick()

    expect(wrapper.findAll('[data-participant-identity="host"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-participant-identity="guest"]')).toHaveLength(0)

    await wrapper.setProps({ stageParticipantId: 'guest' })

    expect(wrapper.findAll('[data-participant-identity="host"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-participant-identity="guest"]')).toHaveLength(1)
  })
})
