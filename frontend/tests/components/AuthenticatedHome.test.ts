import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthenticatedHome from '../../src/components/AuthenticatedHome.vue'
import componentSource from '../../src/components/AuthenticatedHome.vue?raw'
import { endStream } from '../../src/api/streams'
import broadcasterStudioSource from '../../src/components/BroadcasterStudio.vue?raw'

vi.mock('../../src/api/streams', () => ({
  endStream: vi.fn(),
  getStreamByJoinCode: vi.fn(),
}))

const authState = {
  user: { id: 'broadcaster-1', displayName: 'Zhou', role: 'user', accountStatus: 'active' },
}

vi.mock('../../src/stores/auth/store', () => ({
  useAuthStore: () => authState,
}))

describe('AuthenticatedHome live workspace', () => {
  beforeEach(() => {
    authState.user = {
      id: 'broadcaster-1',
      displayName: 'Zhou',
      role: 'user',
      accountStatus: 'active',
    }
    vi.mocked(endStream).mockReset()
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

  it('ends the host stream before clearing the workspace when the host leaves', async () => {
    vi.mocked(endStream).mockResolvedValue({} as never)
    const wrapper = mount(AuthenticatedHome, {
      global: {
        stubs: {
          SiteHeader: true,
          CameraPreview: true,
          LiveKitRoom: {
            emits: ['left'],
            template:
              '<div data-testid="live-room"><button data-testid="leave-live" @click="$emit(\'left\')" /></div>',
          },
          ChatWindow: true,
          BroadcasterStudio: {
            emits: ['liveCreated'],
            setup(_props, { emit }) {
              return {
                emit,
                liveStream: {
                  id: 'stream-host-1',
                  joinCode: '482731',
                  title: '主播直播',
                  description: '',
                  status: 'live',
                  ownerId: 'broadcaster-1',
                  viewerCount: 0,
                  createdAt: '2026-07-29T00:00:00.000Z',
                },
              }
            },
            template:
              '<button data-testid="start-live" @click="emit(\'liveCreated\', liveStream)" />',
          },
          JoinStreamForm: true,
        },
      },
    })

    await wrapper.get('[data-testid="start-live"]').trigger('click')
    await wrapper.get('[data-testid="leave-live"]').trigger('click')

    expect(endStream).toHaveBeenCalledWith('stream-host-1')
    expect(wrapper.find('[data-testid="live-room"]').exists()).toBe(false)
  })

  it('returns to the camera preview when a viewer leaves the live room', async () => {
    authState.user = {
      id: 'broadcaster-1',
      displayName: 'Zhou',
      role: 'user',
      accountStatus: 'active',
    }
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
    authState.user = {
      id: 'broadcaster-1',
      displayName: 'Zhou',
      role: 'user',
      accountStatus: 'active',
    }
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
    authState.user = {
      id: 'broadcaster-1',
      displayName: 'Zhou',
      role: 'user',
      accountStatus: 'active',
    }
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
    expect(componentSource).toContain('ref="chatWindow"')
    expect(componentSource).toContain('@request-stage="handleRequestStage"')
    expect(componentSource).toContain(
      ':pending-stage-requests="isCurrentUserHost ? pendingStageRequests : []"',
    )
    expect(componentSource).toContain('@moderate-stage-request="handleModerateStageRequest"')
  })

  it('wires stage requests, pending state, and role changes across the workspace', async () => {
    authState.user = { id: 'viewer-1', displayName: 'Zhou', role: 'user', accountStatus: 'active' }
    const requestPending = ref(false)
    const hasPendingStageRequest = ref(false)
    const isChatReady = ref(true)
    const requestToJoin = vi.fn()
    const liveRoomMounts = ref(0)
    const liveStream = {
      id: 'stream-viewer-1',
      title: '觀眾正在看的直播',
      description: '',
      status: 'live' as const,
      ownerId: 'broadcaster-1',
      viewerCount: 3,
      createdAt: '2026-07-29T00:00:00.000Z',
    }
    const LiveKitRoomStub = defineComponent({
      props: {
        canRequestStage: Boolean,
        requestStagePending: Boolean,
        hasPendingStageRequest: Boolean,
      },
      emits: ['requestStage'],
      setup(_props, { emit }) {
        liveRoomMounts.value += 1
        return { emit }
      },
      template:
        '<div data-testid="live-room"><button data-testid="request-stage" @click="emit(\'requestStage\')" /><span data-testid="request-capability">{{ canRequestStage }}</span><span data-testid="request-pending">{{ requestStagePending }}</span><span data-testid="request-already-pending">{{ hasPendingStageRequest }}</span></div>',
    })
    const ChatWindowStub = defineComponent({
      emits: ['roleChanged'],
      setup(_props, { expose, emit }) {
        expose({
          requestToJoin,
          isRequestPending: requestPending,
          hasPendingStageRequest,
          isChatReady,
        })
        return { emit }
      },
      template:
        '<div data-testid="chat-window"><button data-testid="role-change" @click="emit(\'roleChanged\', \'guest\')" /></div>',
    })
    const wrapper = mount(AuthenticatedHome, {
      global: {
        stubs: {
          SiteHeader: true,
          CameraPreview: true,
          BroadcasterStudio: {
            emits: ['liveCreated'],
            setup(_props, { emit }) {
              return { emit, liveStream }
            },
            template:
              '<button data-testid="start-live" @click="emit(\'liveCreated\', liveStream)" />',
          },
          JoinStreamForm: true,
          LiveKitRoom: LiveKitRoomStub,
          ChatWindow: ChatWindowStub,
        },
      },
    })

    await wrapper.get('[data-testid="start-live"]').trigger('click')
    const liveRoom = wrapper.findComponent(LiveKitRoomStub)
    expect(liveRoom.props('canRequestStage')).toBe(true)
    expect(liveRoom.get('[data-testid="request-pending"]').text()).toBe('false')

    await liveRoom.get('[data-testid="request-stage"]').trigger('click')
    expect(requestToJoin).toHaveBeenCalledOnce()

    requestPending.value = true
    hasPendingStageRequest.value = true
    await nextTick()
    expect(liveRoom.get('[data-testid="request-pending"]').text()).toBe('true')
    expect(liveRoom.get('[data-testid="request-already-pending"]').text()).toBe('true')

    await wrapper.get('[data-testid="role-change"]').trigger('click')
    await nextTick()
    expect(liveRoomMounts.value).toBe(2)
    expect(wrapper.findComponent(LiveKitRoomStub).props('canRequestStage')).toBe(false)
  })
})
