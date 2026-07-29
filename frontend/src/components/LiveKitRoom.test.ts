import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LiveKitRoom from './LiveKitRoom.vue'
import componentSource from './LiveKitRoom.vue?raw'

describe('LiveKitRoom', () => {
  it('does not render a duplicate chat panel', () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1' },
    })

    expect(wrapper.find('input[placeholder="Say something…"]').exists()).toBe(false)
    expect(componentSource).not.toContain('聊天室')
  })

  it('does not attach already published remote tracks a second time', () => {
    expect(componentSource).not.toContain('remoteParticipants.values()')
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

  it('keeps broadcaster camera and microphone controls inside the live video surface', () => {
    expect(componentSource).toContain('canPublish')
    expect(componentSource).toContain('setCameraEnabled')
    expect(componentSource).toContain('setMicrophoneEnabled')
    expect(componentSource).toContain('data-testid="live-toggle-camera"')
    expect(componentSource).toContain('data-testid="live-toggle-microphone"')
    expect(componentSource).toContain('aria-label="直播媒體控制"')
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

  it('shows a closable broadcaster code popup that can be reopened from the header icon', async () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1', joinCode: '482731' },
    })

    expect(wrapper.get('[data-testid="live-code-popup"]').text()).toContain('482731')
    await wrapper.get('[data-testid="live-code-close"]').trigger('click')
    expect(wrapper.find('[data-testid="live-code-popup"]').exists()).toBe(false)
    await wrapper.get('[data-testid="live-code-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="live-code-popup"]').text()).toContain('482731')
  })
})
