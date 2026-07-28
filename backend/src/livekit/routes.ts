import { Router } from 'express'

import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import type { UserRepository } from '../auth/repository.js'
import type { StreamRepository } from '../streams/repository.js'
import { createLiveKitToken, type LiveKitConfig } from './service.js'

export function createLiveKitRouter(
  userRepository: UserRepository,
  streamRepository: StreamRepository,
  config: LiveKitConfig,
) {
  const router = Router()

  router.post('/token', requireAuth(userRepository), async (request: AuthenticatedRequest, response) => {
    const streamId = typeof request.body?.streamId === 'string' ? request.body.streamId : undefined
    const stream = streamId ? await streamRepository.findById(streamId) : undefined
    const user = await userRepository.findById(request.userId!)

    if (!stream || !user) {
      response.status(404).json({ success: false, code: 'STREAM_NOT_FOUND', message: 'Stream was not found' })
      return
    }
    if (stream.status !== 'live') {
      response.status(409).json({ success: false, code: 'STREAM_NOT_LIVE', message: 'Stream is not live' })
      return
    }
    if (user.role === 'broadcaster' && stream.broadcasterId !== user.id) {
      response.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You cannot join this stream as broadcaster' })
      return
    }

    try {
      response.json({ success: true, data: await createLiveKitToken(config, user, stream) })
    } catch (error) {
      if (error instanceof Error && error.message === 'LIVEKIT_NOT_CONFIGURED') {
        response.status(503).json({ success: false, code: 'LIVEKIT_NOT_CONFIGURED', message: 'LiveKit is not configured' })
        return
      }
      throw error
    }
  })

  return router
}