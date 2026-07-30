import { AccessToken } from 'livekit-server-sdk'

import type { UserRole } from '../auth/store.js'
import type { ParticipantRole } from '../streams/participants.js'
import type { StreamRecord } from '../streams/store.js'

export interface LiveKitConfig {
  apiKey?: string
  apiSecret?: string
  url?: string
}

export async function createLiveKitToken(
  config: LiveKitConfig,
  user: { id: string; displayName: string; role: UserRole },
  stream: StreamRecord,
  participantRole: ParticipantRole = stream.ownerId === user.id ? 'host' : 'viewer',
) {
  if (!config.apiKey || !config.apiSecret || !config.url) throw new Error('LIVEKIT_NOT_CONFIGURED')

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: user.id,
    name: user.displayName,
    ttl: '15m',
  })
  token.addGrant({
    room: roomNameForStream(stream.id),
    roomJoin: true,
    canPublish: participantRole === 'host' || participantRole === 'guest',
    canSubscribe: true,
    canPublishData: true,
  })

  const canPublish = participantRole === 'host' || participantRole === 'guest'
  return {
    token: await token.toJwt(),
    url: config.url,
    roomName: roomNameForStream(stream.id),
    canPublish,
    canSubscribe: true,
    sessionRole: participantRole,
  }
}

export function roomNameForStream(streamId: string) {
  return `stream-${streamId}`
}