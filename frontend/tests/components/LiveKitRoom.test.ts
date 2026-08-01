import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import LiveKitRoom from '../../src/components/LiveKitRoom.vue'
import componentSource from '../../src/components/LiveKitRoom.vue?raw'

describe('LiveKitRoom', () => {
  it('does not render a duplicate chat panel', () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1' },
    })

    expect(wrapper.find('input[placeholder="Say something…"]').exists()).toBe(false)
    expect(componentSource).not.toContain('LIVE CHAT')
  })

  it('attaches already published remote tracks without duplicating subscribed tracks', () => {
    expect(componentSource).toContain('remoteParticipants.values()')
    expect(componentSource).toContain('publication.isSubscribed')
    expect(componentSource).toContain('remoteTracks.set(participantIdentity, track)')
    expect(componentSource).toContain('renderStageVideo()')
  })

  it('does not show a manual join button for auto-connected rooms', () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1', autoConnect: true },
    })

    expect(wrapper.find('button').exists()).toBe(false)
    expect(componentSource).toContain('加入直播')
    expect(componentSource).toContain('離開直播')
    expect(componentSource).not.toContain('Join live')
    expect(componentSource).not.toContain('>\n        Leave\n')
  })

  it('places the viewer stage request next to the leave control', () => {
    expect(componentSource).toContain('hasPendingStageRequest?: boolean')
    expect(componentSource).toContain('data-testid="participant-request"')
    expect(componentSource).toContain('@click="emit(\'requestStage\')"')
    expect(componentSource).toContain(
      ':disabled="props.requestStagePending || props.hasPendingStageRequest"',
    )
    expect(componentSource).toContain('離開直播')
    expect(componentSource).toContain('canLeaveStage?: boolean')
    expect(componentSource).toContain('data-testid="participant-leave-stage"')
  })

  it('renders host stage selection and guest removal controls in the live room header', () => {
    expect(componentSource).toContain('stageGuests?:')
    expect(componentSource).toContain('hostParticipantId?: string')
    expect(componentSource).toContain('hostParticipantName?: string')
    expect(componentSource).toContain("emit('removeGuest'")
    expect(componentSource).toContain('主畫面：')
    expect(componentSource).toContain('退出來賓')
    expect(componentSource).toContain('text-[11px]')
    expect(componentSource).not.toContain("emit('changeStage'")
    expect(componentSource).not.toContain('>\n          主播\n        </button>')
  })

  it('shows host stage requests as an overlay near the top center of the live surface', async () => {
    const wrapper = mount(LiveKitRoom, {
      props: {
        streamId: 'stream-1',
        pendingStageRequests: [{ id: 'request-1', displayName: 'user001' }],
      },
    })

    const notification = wrapper.get('[data-testid="stage-request-notification"]')
    expect(notification.classes()).toEqual(
      expect.arrayContaining(['absolute', 'top-5', 'left-1/2', '-translate-x-1/2']),
    )
    expect(notification.text()).toContain('user001')
    expect(notification.text()).toContain('同意上台')
    expect(notification.text()).toContain('拒絕')

    await notification.get('button').trigger('click')
    expect(wrapper.emitted('moderateStageRequest')).toEqual([['approve', 'request-1']])
  })

  it('keeps broadcaster camera and microphone controls inside the live video surface', () => {
    expect(componentSource).toContain('canPublish')
    expect(componentSource).toContain('setCameraEnabled')
    expect(componentSource).toContain('setMicrophoneEnabled')
    expect(componentSource).toContain('data-testid="live-toggle-camera"')
    expect(componentSource).toContain('data-testid="live-toggle-microphone"')
    expect(componentSource).toContain('aria-label="直播媒體控制"')
  })

  it('does not render a local preview or participant picture-in-picture window', () => {
    expect(componentSource).not.toContain('local-video-container')
    expect(componentSource).not.toContain('localVideoPreviewStyle')
    expect(componentSource).not.toContain('right-3 bottom-3 z-10 rounded-lg')
    expect(componentSource).toContain('v-if="isConnected && canPublish"')
    expect(componentSource).toContain('只有目前 stage participant 的 video 會填滿主畫面')
  })

  it('keeps the live video surface constrained to its grid column', () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1' },
    })

    const videoSurface = wrapper.find('[data-testid="live-video-surface"]')
    expect(videoSurface.classes()).toContain('aspect-video')
    expect(videoSurface.classes()).toContain('w-full')
    expect(videoSurface.classes()).not.toContain('h-full')
    expect(wrapper.find('[data-testid="remote-video-container"]').classes()).toContain('absolute')
    expect(wrapper.find('[data-testid="live-default-state"]').exists()).toBe(true)
    expect(componentSource).toContain('group-hover:opacity-100')
    expect(componentSource).toContain('focus-within:opacity-100')
  })

  it('keeps the live room itself shrinkable inside the workspace grid', () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1' },
    })

    expect(wrapper.find('section').classes()).toContain('min-w-0')
    expect(wrapper.find('section').classes()).not.toContain('mt-8')
  })

  it('supports an externally selected stage participant and participant track registry', () => {
    expect(componentSource).toContain('stageParticipantId')
    expect(componentSource).toContain('remoteTracks')
    expect(componentSource).toContain('participant.identity')
    expect(componentSource).toContain('stageVideoClass')
  })

  it('does not treat component cleanup as a live-room leave', () => {
    expect(componentSource).toContain('onBeforeUnmount')
    expect(componentSource).toContain('isUnmounting = true')
    expect(componentSource).toContain("if (!isUnmounting && !disconnectRequested) emit('left')")
  })

  it('shows a closable broadcaster code popup that can be reopened from the header icon', async () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1', joinCode: '482731' },
    })

    expect(wrapper.get('[data-testid="live-code-popup"]').text()).toContain('482731')
    expect(wrapper.get('[data-testid="live-code-popup"]').classes()).toEqual(
      expect.arrayContaining(['top-3', 'left-3']),
    )
    await wrapper.get('[data-testid="live-code-close"]').trigger('click')
    expect(wrapper.find('[data-testid="live-code-popup"]').exists()).toBe(false)
    await wrapper.get('[data-testid="live-code-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="live-code-popup"]').text()).toContain('482731')
  })

  it('copies the broadcaster code from the code popup', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1', joinCode: '482731' },
    })

    await wrapper.get('[data-testid="live-code-copy"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('482731')
    expect(wrapper.get('[data-testid="live-code-copy"]').attributes('aria-label')).toBe(
      '已複製直播代碼',
    )
  })
})
