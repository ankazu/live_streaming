import { randomInt } from 'node:crypto'

import { Prisma, PrismaClient } from '@prisma/client'

import type { StreamRecord, StreamStatus } from './store.js'
import type { StreamRepository } from './repository.js'

export class PrismaStreamRepository implements StreamRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: { title: string; description?: string; broadcasterId: string }) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const stream = await this.db.stream.create({
          data: {
            joinCode: this.createJoinCode(),
            title: input.title.trim(),
            description: input.description?.trim() ?? '',
            broadcasterId: input.broadcasterId,
          },
        })
        return toStreamRecord(stream)
      } catch (error) {
        if (!isJoinCodeCollision(error) || attempt === 4) throw error
      }
    }
    throw new Error('JOIN_CODE_GENERATION_FAILED')
  }

  async list() {
    const streams = await this.db.stream.findMany({
      where: { status: { not: 'ended' } },
      orderBy: { createdAt: 'asc' },
    })
    return streams.map(toStreamRecord)
  }

  async findById(id: string) {
    const stream = await this.db.stream.findUnique({ where: { id } })
    return stream ? toStreamRecord(stream) : undefined
  }

  async findByJoinCode(joinCode: string) {
    const stream = await this.db.stream.findUnique({ where: { joinCode } })
    return stream ? toStreamRecord(stream) : undefined
  }

  async start(id: string) {
    const stream = await this.requireStream(id)
    if (stream.status !== 'scheduled') throw new Error('INVALID_STREAM_STATUS')

    const updated = await this.db.stream.update({
      where: { id },
      data: { status: 'live', startedAt: new Date() },
    })
    return toStreamRecord(updated)
  }

  async end(id: string) {
    const stream = await this.requireStream(id)
    if (stream.status !== 'live') throw new Error('INVALID_STREAM_STATUS')

    const updated = await this.db.stream.update({
      where: { id },
      data: { status: 'ended', endedAt: new Date() },
    })
    return toStreamRecord(updated)
  }

  private createJoinCode() {
    return String(randomInt(100000, 1000000))
  }

  private async requireStream(id: string) {
    const stream = await this.findById(id)
    if (!stream) throw new Error('STREAM_NOT_FOUND')
    return stream
  }
}

function isJoinCodeCollision(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function toStreamRecord(stream: {
  id: string
  joinCode: string
  title: string
  description: string
  status: string
  broadcasterId: string
  viewerCount: number
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
}): StreamRecord {
  return {
    id: stream.id,
    joinCode: stream.joinCode,
    title: stream.title,
    description: stream.description,
    status: stream.status as StreamStatus,
    broadcasterId: stream.broadcasterId,
    viewerCount: stream.viewerCount,
    createdAt: stream.createdAt.toISOString(),
    ...(stream.startedAt ? { startedAt: stream.startedAt.toISOString() } : {}),
    ...(stream.endedAt ? { endedAt: stream.endedAt.toISOString() } : {}),
  }
}
