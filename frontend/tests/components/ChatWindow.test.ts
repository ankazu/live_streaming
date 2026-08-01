import { describe, expect, it } from 'vitest'

import componentSource from '../../src/components/ChatWindow.vue?raw'

describe('ChatWindow layout', () => {
  it('exposes viewer request and host moderation controls', () => {
    expect(componentSource).toContain('participant:request')
    expect(componentSource).toContain('participant:approve')
    expect(componentSource).toContain('participant:reject')
    expect(componentSource).toContain('participant:remove')
    expect(componentSource).toContain('participant:leave-stage')
    expect(componentSource).toContain('stage:change')
    expect(componentSource).toContain('stage:changed')
    expect(componentSource).toContain('requestToJoin')
    expect(componentSource).toContain('defineExpose')
    expect(componentSource).toContain('移除來賓')
    expect(componentSource).toContain('下舞台')
    expect(componentSource).toContain('主畫面')
    expect(componentSource).toContain('pendingStageRequests')
    expect(componentSource).toContain('moderateRequest')
  })

  it('keeps a successful stage request pending until the server resolves it', () => {
    expect(componentSource).toContain('hasPendingStageRequest')
    expect(componentSource).toContain('hasPendingStageRequest.value = true')
    expect(componentSource).toContain('requestPending.value || hasPendingStageRequest.value')
    expect(componentSource).toContain('participant:approved')
    expect(componentSource).toContain('participant:rejected')
  })

  it('does not expose a duplicate canRequestStage capability', () => {
    expect(componentSource).not.toContain('canRequestStage: computed')
  })

  it('accepts workspace identity and moderation props', () => {
    expect(componentSource).toContain('userId?: string')
    expect(componentSource).toContain('canModerate?: boolean')
    expect(componentSource).toContain('isChatReady')
  })

  it('wraps long unbroken messages without expanding the chat column', () => {
    expect(componentSource).toContain('class="min-w-0')
    expect(componentSource).toContain('break-words')
  })

  it('keeps the message list as the scrollable area inside a bounded panel', () => {
    expect(componentSource).toContain('h-full')
    expect(componentSource).toContain('max-h-[353px]')
    expect(componentSource).toContain('overflow-hidden')
    expect(componentSource).toContain('overflow-y-auto')
  })
})
