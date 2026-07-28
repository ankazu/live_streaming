import { AccessToken } from 'livekit-server-sdk'

import type { UserRole } from '../auth/store.js'
import type { StreamRecord } from '../streams/store.js'

export interface LiveKitConfig {
  apiKey?: string
  apiSecret?: string
  url?: string
}

export function createLiveKitToken(config: LiveKitConfig, user: { id: string; displayName: string; role: UserRole }, stream: StreamRecord) {
  if (!config.apiKey || !config.apiSecret || !config.url) throw new Error('LIVEKIT_NOT_CONFIGURED')

  const isBroadcaster = user.role === 'broadcaster' && user.id === stream.broadcasterId
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: user.id,
    name: user.displayName,
    ttl: '15m',
  })
  token.addGrant({
    room: roomNameForStream(stream.id),
    roomJoin: true,
    canPublish: isBroadcaster,
    canSubscribe: true,
    canPublishData: true,
  })

  return { token: token.toJwt(), url: config.url, roomName: roomNameForStream(stream.id), canPublish: isBroadcaster }
}

export function roomNameForStream(streamId: string) {
  return `stream-${streamId}`
}