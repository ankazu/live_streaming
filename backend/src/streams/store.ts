import { randomUUID } from 'node:crypto'

import type { UserRole } from '../auth/store.js'
import type { StreamRepository } from './repository.js'

export type StreamStatus = 'scheduled' | 'live' | 'ended'

export interface StreamRecord {
  id: string
  title: string
  description: string
  status: StreamStatus
  broadcasterId: string
  viewerCount: number
  createdAt: string
  startedAt?: string
  endedAt?: string
}

export class StreamStore implements StreamRepository {
  private readonly streams = new Map<string, StreamRecord>()

  async create(input: { title: string; description?: string; broadcasterId: string }) {
    const stream: StreamRecord = {
      id: randomUUID(),
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: 'scheduled',
      broadcasterId: input.broadcasterId,
      viewerCount: 0,
      createdAt: new Date().toISOString(),
    }

    this.streams.set(stream.id, stream)
    return stream
  }

  async list() {
    return [...this.streams.values()].filter((stream) => stream.status !== 'ended')
  }

  async findById(id: string) {
    return this.streams.get(id)
  }

  async start(id: string) {
    const stream = await this.requireStream(id)
    if (stream.status !== 'scheduled') throw new Error('INVALID_STREAM_STATUS')

    stream.status = 'live'
    stream.startedAt = new Date().toISOString()
    return stream
  }

  async end(id: string) {
    const stream = await this.requireStream(id)
    if (stream.status !== 'live') throw new Error('INVALID_STREAM_STATUS')

    stream.status = 'ended'
    stream.endedAt = new Date().toISOString()
    return stream
  }

  private async requireStream(id: string) {
    const stream = await this.findById(id)
    if (!stream) throw new Error('STREAM_NOT_FOUND')
    return stream
  }
}

export function canManageStream(role: UserRole, stream: StreamRecord, userId: string) {
  return role === 'admin' || (role === 'broadcaster' && stream.broadcasterId === userId)
}
