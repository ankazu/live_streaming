import { describe, expect, it, vi } from 'vitest'

import { createAndStartStream } from './broadcaster-flow'
import type { Stream } from '../types/stream'

const scheduledStream: Stream = {
  id: 'stream-1',
  title: '測試直播',
  description: '測試簡介',
  status: 'scheduled',
  broadcasterId: 'broadcaster-1',
  viewerCount: 0,
  createdAt: '2026-07-29T00:00:00.000Z',
}

const liveStream: Stream = {
  ...scheduledStream,
  status: 'live',
  startedAt: '2026-07-29T00:01:00.000Z',
}

describe('broadcaster live flow', () => {
  it('starts the created stream immediately without a separate start action', async () => {
    const create = vi.fn().mockResolvedValue(scheduledStream)
    const start = vi.fn().mockResolvedValue(liveStream)

    await expect(
      createAndStartStream({ title: '測試直播', description: '測試簡介' }, create, start),
    ).resolves.toEqual(liveStream)

    expect(create).toHaveBeenCalledWith({ title: '測試直播', description: '測試簡介' })
    expect(start).toHaveBeenCalledWith('stream-1')
  })
})
