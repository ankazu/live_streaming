import { Router, type Response } from 'express'

import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import type { UserRepository } from '../auth/repository.js'
import type { StreamRepository } from './repository.js'
import { canManageStream, StreamStore } from './store.js'

export function createStreamRouter(
  userRepository: UserRepository,
  streamRepository: StreamRepository = new StreamStore(),
  options: { onStreamEnded?: (streamId: string) => void } = {},
) {
  const router = Router()
  const joinCodeLookups = new Map<string, { startedAt: number; count: number }>()
  const joinCodeRateLimit = { windowMs: 60_000, max: 10 }

  router.get('/', async (_request, response) => {
    response.json({ success: true, data: { items: await streamRepository.list() } })
  })

  router.post('/', requireAuth(userRepository), async (request: AuthenticatedRequest, response) => {
    const { title, description } = request.body ?? {}
    const user = await userRepository.findById(request.userId!)

    if (!user || user.accountStatus !== 'active') {
      response.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Active account required' })
      return
    }
    if (title !== undefined && typeof title !== 'string') {
      response.status(400).json({ success: false, code: 'INVALID_TITLE', message: 'Title must be text' })
      return
    }
    if (typeof title === 'string' && title.trim().length > 0 && title.trim().length < 3) {
      response.status(400).json({ success: false, code: 'INVALID_TITLE', message: 'Title must be at least 3 characters' })
      return
    }
    if (description !== undefined && typeof description !== 'string') {
      response.status(400).json({ success: false, code: 'INVALID_DESCRIPTION', message: 'Description must be text' })
      return
    }
    const stream = await streamRepository.create({
      title: typeof title === 'string' && title.trim() ? title : `${user.displayName} 的直播`,
      description,
      ownerId: user.id,
    })
    response.status(201).json({ success: true, data: { stream } })
  })

  router.get('/code/:joinCode', requireAuth(userRepository), async (request: AuthenticatedRequest, response) => {
    if (!allowJoinCodeLookup(request.userId ?? 'unknown')) {
      response.status(429).json({
        success: false,
        code: 'JOIN_CODE_RATE_LIMITED',
        message: 'Too many join code lookups. Please try again later.',
      })
      return
    }

    const joinCode = typeof request.params.joinCode === 'string' ? request.params.joinCode : ''
    if (!/^\d{6}$/.test(joinCode)) {
      response.status(400).json({ success: false, code: 'INVALID_JOIN_CODE', message: 'Join code must be six digits' })
      return
    }

    const stream = await streamRepository.findByJoinCode(joinCode)
    if (!stream || stream.status !== 'live') {
      response.status(404).json({ success: false, code: 'STREAM_NOT_FOUND', message: 'Live stream was not found' })
      return
    }
    response.json({ success: true, data: { stream } })
  })

  function allowJoinCodeLookup(userId: string) {
    const now = Date.now()
    const current = joinCodeLookups.get(userId)
    if (!current || now - current.startedAt >= joinCodeRateLimit.windowMs) {
      joinCodeLookups.set(userId, { startedAt: now, count: 1 })
      return true
    }
    if (current.count >= joinCodeRateLimit.max) return false
    current.count += 1
    return true
  }

  router.post('/:id/start', requireAuth(userRepository), async (request: AuthenticatedRequest, response) => {
    await updateStatus('start', request, response)
  })

  router.post('/:id/end', requireAuth(userRepository), async (request: AuthenticatedRequest, response) => {
    await updateStatus('end', request, response)
  })

  async function updateStatus(action: 'start' | 'end', request: AuthenticatedRequest, response: Response) {
    const streamId = typeof request.params.id === 'string' ? request.params.id : undefined
    const stream = streamId ? await streamRepository.findById(streamId) : undefined
    const user = await userRepository.findById(request.userId!)

    if (!stream || !user) {
      response.status(404).json({ success: false, code: 'STREAM_NOT_FOUND', message: 'Stream was not found' })
      return
    }
    if (!canManageStream(user.role, stream, user.id)) {
      response.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You cannot manage this stream' })
      return
    }
    if (user.accountStatus !== 'active') {
      response.status(403).json({ success: false, code: 'ACCOUNT_NOT_ACTIVE', message: 'Account is not active' })
      return
    }

    try {
      const updated = action === 'start' ? await streamRepository.start(stream.id) : await streamRepository.end(stream.id)
      if (action === 'end') options.onStreamEnded?.(stream.id)
      response.json({ success: true, data: { stream: updated } })
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_STREAM_STATUS') {
        response.status(409).json({ success: false, code: 'INVALID_STREAM_STATUS', message: `Cannot ${action} this stream` })
        return
      }
      throw error
    }
  }

  return { router, streamRepository }
}
