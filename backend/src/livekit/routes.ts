import { Router } from 'express'

import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import type { UserRepository } from '../auth/repository.js'
import type { StreamRepository } from '../streams/repository.js'
import type { ParticipantManager } from '../streams/participants.js'
import { createLiveKitToken, type LiveKitConfig } from './service.js'

export function createLiveKitRouter(
  userRepository: UserRepository,
  streamRepository: StreamRepository,
  config: LiveKitConfig,
  participantManager?: ParticipantManager,
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
    if (user.accountStatus !== 'active') {
      response.status(403).json({ success: false, code: 'ACCOUNT_NOT_ACTIVE', message: 'Account is not active' })
      return
    }
    if (stream.status !== 'live') {
      response.status(409).json({ success: false, code: 'STREAM_NOT_LIVE', message: 'Stream is not live' })
      return
    }

    try {
      const participantRole = stream.ownerId === user.id ? 'host' : participantManager?.getParticipant(stream.id, user.id)?.role ?? 'viewer'
      response.json({ success: true, data: await createLiveKitToken(config, user, stream, participantRole) })
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