import { describe, expect, it } from 'vitest'

import type { Stream } from '../types/stream'
import {
  clearWorkspaceSession,
  readWorkspaceSession,
  writeWorkspaceSession,
} from './workspace-session'

const stream: Stream = {
  id: 'stream-1',
  joinCode: '123456',
  title: '測試直播',
  description: '',
  status: 'live',
  ownerId: 'user-1',
  viewerCount: 1,
  createdAt: '2026-07-31T00:00:00.000Z',
}

describe('workspace session', () => {
  it('persists and restores the active stream mode and stream record', () => {
    const storage = new Map<string, string>()

    writeWorkspaceSession(storage, 'host', stream)

    expect(readWorkspaceSession(storage)).toEqual({ mode: 'host', stream })
  })

  it('clears the persisted stream when the user leaves', () => {
    const storage = new Map<string, string>()
    writeWorkspaceSession(storage, 'viewer', stream)

    clearWorkspaceSession(storage)

    expect(readWorkspaceSession(storage)).toBeNull()
  })

  it('ignores malformed persisted data', () => {
    const storage = new Map<string, string>([['live-streaming.workspace', '{broken']])

    expect(readWorkspaceSession(storage)).toBeNull()
  })
})
