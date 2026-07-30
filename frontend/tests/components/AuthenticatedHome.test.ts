import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthenticatedHome from '../../src/components/AuthenticatedHome.vue'
import componentSource from '../../src/components/AuthenticatedHome.vue?raw'
import broadcasterStudioSource from '../../src/components/BroadcasterStudio.vue?raw'

const authState = {
  user: { displayName: 'Zhou', role: 'user', accountStatus: 'active' },
}

vi.mock('../../src/stores/auth/store', () => ({
  useAuthStore: () => authState,
}))

describe('AuthenticatedHome live workspace', () => {
  beforeEach(() => {
    authState.user = { displayName: 'Zhou', role: 'user', accountStatus: 'active' }
  })

  it('does not stretch the inactive camera card to the viewport height', () => {
    expect(componentSource).toContain(
      'class="grid items-start gap-8 py-10 lg:grid-cols-[1.35fr_0.65fr]"',
    )
    expect(componentSource).toContain(':class="{ \'lg:items-stretch\': currentStream }"')
    expect(componentSource).toContain(":class=\"currentStream ? 'h-full min-h-0' : ''\"")
    expect(componentSource).not.toContain('lg:h-[calc(100vh-1rem)]')
  })

  it('does not expose a one-to-one stream mode in the broadcaster workspace', () => {
    expect(broadcasterStudioSource).not.toContain('一對一互動')
    expect(broadcasterStudioSource).not.toContain('one_to_one')
    expect(broadcasterStudioSource).not.toContain('選擇直播形式')
  })

  it('replaces the camera preview and quick start panel after a live stream is created', async () => {
    const wrapper = mount(AuthenticatedHome, {
      global: {
        stubs: {
          SiteHeader: true,
          CameraPreview: { template: '<div data-testid="camera-preview" />' },
          LiveKitRoom: {
            props: ['streamId', 'joinCode', 'autoConnect'],
            emits: ['left'],
            template:
              '<div data-testid="live-room"><button data-testid="leave-live" @click="$emit(\'left\')" />{{ joinCode }} {{ autoConnect }}</div>',
          },
          ChatWindow: { template: '<div data-testid="chat-window" />' },
          BroadcasterStudio: {
            props: ['activeStream'],
            emits: ['liveCreated'],
            template:
              '<div data-testid="broadcaster-studio"><button data-testid="start-live" @click="$emit(\'liveCreated\', liveStream)" /><span>{{ activeStream?.joinCode }}</span></div>',
            data: () => ({
              liveStream: {
                id: 'stream-1',
                joinCode: '482731',
                title: '測試直播',
                description: '',
                status: 'live',
                ownerId: 'broadcaster-1',
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
    expect(wrapper.find('[data-testid="broadcaster-studio"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="live-room"]').text()).toContain('482731')
    const workspaceGrid = wrapper.get('[data-testid="workspace-grid"]')
    const rightColumn = wrapper.get('[data-testid="workspace-right"]')
    expect(workspaceGrid.element.children[1]).toBe(rightColumn.element)
    expect(rightColumn.find('[data-testid="chat-window"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('QUICK START')
    await wrapper.get('[data-testid="leave-live"]').trigger('click')
    expect(wrapper.find('[data-testid="live-room"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="camera-preview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="broadcaster-studio"]').exists()).toBe(true)
  })

  it('returns to the camera preview when a viewer leaves the live room', async () => {
    authState.user = { displayName: 'Zhou', role: 'user', accountStatus: 'active' }
    const wrapper = mount(AuthenticatedHome, {
      global: {
        stubs: {
          SiteHeader: true,
          CameraPreview: { template: '<div data-testid="camera-preview" />' },
          LiveKitRoom: {
            emits: ['left'],
            template:
              '<div data-testid="live-room"><button data-testid="leave-live" @click="$emit(\'left\')" /></div>',
          },
          ChatWindow: { template: '<div data-testid="chat-window" />' },
          JoinStreamForm: {
            emits: ['watchLive'],
            template:
              '<button data-testid="join-live" @click="$emit(\'watchLive\', liveStream)" />',
            data: () => ({
              liveStream: {
                id: 'stream-viewer-1',
                title: '觀眾正在看的直播',
                description: '',
                status: 'live',
                ownerId: 'broadcaster-1',
                viewerCount: 3,
                createdAt: '2026-07-29T00:00:00.000Z',
              },
            }),
          },
          BroadcasterStudio: true,
        },
      },
    })

    await wrapper.get('[data-testid="join-live"]').trigger('click')
    expect(wrapper.find('[data-testid="live-room"]').exists()).toBe(true)

    await wrapper.get('[data-testid="leave-live"]').trigger('click')

    expect(wrapper.find('[data-testid="live-room"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="chat-window"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="camera-preview"]').exists()).toBe(true)
  })

  it('shows both host studio and join form for a regular user', () => {
    authState.user = { displayName: 'Zhou', role: 'user', accountStatus: 'active' }
    const wrapper = mount(AuthenticatedHome, {
      global: {
        stubs: {
          SiteHeader: true,
          CameraPreview: true,
          BroadcasterStudio: { template: '<div data-testid="broadcaster-studio" />' },
          JoinStreamForm: { template: '<div data-testid="join-stream-form" />' },
        },
      },
    })

    expect(wrapper.find('[data-testid="broadcaster-studio"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="join-stream-form"]').exists()).toBe(true)
  })
  it('lets a viewer enter a join code from the right workspace panel', async () => {
    authState.user = { displayName: 'Zhou', role: 'user', accountStatus: 'active' }
    const wrapper = mount(AuthenticatedHome, {
      global: {
        stubs: {
          SiteHeader: true,
          CameraPreview: { template: '<div data-testid="camera-preview" />' },
          LiveKitRoom: {
            props: ['streamId', 'joinCode', 'autoConnect'],
            template: '<div data-testid="live-room">{{ autoConnect }}</div>',
          },
          ChatWindow: {
            props: ['streamId'],
            template: '<div data-testid="chat-window" />',
          },
          JoinStreamForm: {
            emits: ['watchLive'],
            template:
              '<button data-testid="join-live" @click="$emit(\'watchLive\', liveStream)" />',
            data: () => ({
              liveStream: {
                id: 'stream-viewer-1',
                title: '觀眾正在看的直播',
                description: '',
                status: 'live',
                ownerId: 'broadcaster-1',
                viewerCount: 3,
                createdAt: '2026-07-29T00:00:00.000Z',
              },
            }),
          },
          BroadcasterStudio: true,
        },
      },
    })

    await wrapper.get('[data-testid="join-live"]').trigger('click')

    expect(wrapper.find('[data-testid="camera-preview"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="live-room"]').text()).toContain('true')
    expect(wrapper.text()).toContain('QUICK START')
  })

  it('passes host moderation context to the live chat', () => {
    expect(componentSource).toContain(':can-moderate="isCurrentUserHost"')
    expect(componentSource).toContain(':user-id="auth.user?.id"')
    expect(componentSource).toContain(':stage-participant-id="stageParticipantId"')
    expect(componentSource).toContain('@stage-changed="handleStageChanged"')
  })
})
