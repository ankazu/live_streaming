import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthenticatedHome from './AuthenticatedHome.vue'

const authState = {
  user: { displayName: 'Zhou', role: 'broadcaster', accountStatus: 'active' },
}

vi.mock('../stores/auth/store', () => ({
  useAuthStore: () => authState,
}))

describe('AuthenticatedHome live workspace', () => {
  beforeEach(() => {
    authState.user = { displayName: 'Zhou', role: 'broadcaster', accountStatus: 'active' }
  })

  it('replaces the camera preview and quick start panel after a live stream is created', async () => {
    const wrapper = mount(AuthenticatedHome, {
      global: {
        stubs: {
          SiteHeader: true,
          CameraPreview: { template: '<div data-testid="camera-preview" />' },
          LiveKitRoom: {
            props: ['streamId', 'title', 'autoConnect'],
            template: '<div data-testid="live-room">{{ autoConnect }}</div>',
          },
          ChatWindow: { template: '<div data-testid="chat-window" />' },
          StreamGrid: true,
          BroadcasterStudio: {
            emits: ['liveCreated'],
            template:
              '<button data-testid="start-live" @click="$emit(\'liveCreated\', liveStream)" />',
            data: () => ({
              liveStream: {
                id: 'stream-1',
                title: '測試直播',
                description: '',
                status: 'live',
                broadcasterId: 'broadcaster-1',
                viewerCount: 0,
                createdAt: '2026-07-29T00:00:00.000Z',
              },
            }),
          },
        },
      },
    })

    expect(wrapper.find('[data-testid="camera-preview"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('QUICK START')

    await wrapper.get('[data-testid="start-live"]').trigger('click')

    expect(wrapper.find('[data-testid="camera-preview"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="live-room"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="chat-window"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('QUICK START')
  })
})
