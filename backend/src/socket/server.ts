import { randomUUID } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'

import { Server } from 'socket.io'

import type { UserRepository } from '../auth/repository.js'
import { toPublicUser } from '../auth/store.js'
import { verifyAccessToken } from '../auth/token.js'
import type { StreamRepository } from '../streams/repository.js'
import { ParticipantError, ParticipantManager } from '../streams/participants.js'

type Presence = { userId: string; displayName: string; socketId: string; joinedAt: string }

const CHAT_RATE_LIMIT_MAX_MESSAGES = 5
const CHAT_RATE_LIMIT_WINDOW_MS = 10_000

export function createSocketServer(
  httpServer: HttpServer,
  userRepository: UserRepository,
  streamRepository: StreamRepository,
  participantManager = new ParticipantManager(),
) {
  const io = new Server(httpServer, {
    cors: { origin: getSocketCorsOrigins() },
  })
  const presence = new Map<string, Map<string, Presence>>()
  const chatRateLimits = new Map<string, number[]>()

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (typeof token !== 'string') return next(new Error('UNAUTHORIZED'))
    try {
      const userId = await verifyAccessToken(token)
      const user = await userRepository.findById(userId)
      if (!user) return next(new Error('UNAUTHORIZED'))
      socket.data.user = toPublicUser(user)
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as ReturnType<typeof toPublicUser>
    let currentStreamId: string | undefined

    socket.on('stream:join', async (streamId: unknown, callback?: (result: object) => void) => {
      if (typeof streamId !== 'string') return callback?.({ success: false, code: 'INVALID_STREAM' })
      let joinedStreamId: string | undefined
      try {
        const stream = await streamRepository.findById(streamId)
        if (!stream || stream.status !== 'live') return callback?.({ success: false, code: 'STREAM_NOT_LIVE' })
        await socket.join(roomName(stream.id))
        joinedStreamId = stream.id
        if (currentStreamId) leaveStream()
        currentStreamId = stream.id
        const streamPresence = presence.get(stream.id) ?? new Map<string, Presence>()
        streamPresence.set(socket.id, { userId: user.id, displayName: user.displayName, socketId: socket.id, joinedAt: new Date().toISOString() })
        presence.set(stream.id, streamPresence)
        const participant = participantManager.join(stream.id, user, socket.id, stream.ownerId === user.id)
        socket.emit('presence:snapshot', [...streamPresence.values()])
        socket.emit('participant:requests', participant.role === 'host' ? participantManager.getPendingRequests(stream.id) : [])
        socket.emit('stage:changed', {
          streamId: stream.id,
          participantId: participantManager.getStage(stream.id) ?? stream.ownerId,
        })
        socket.to(roomName(stream.id)).emit('presence:joined', { user: { id: user.id, displayName: user.displayName } })
        socket.to(roomName(stream.id)).emit('participant:joined', participant)
        io.to(roomName(stream.id)).emit('presence:count', { viewerCount: streamPresence.size })
        callback?.({ success: true, viewerCount: streamPresence.size })
      } catch {
        if (joinedStreamId) socket.leave(roomName(joinedStreamId))
        callback?.({ success: false, code: 'JOIN_FAILED' })
      }
    })

    socket.on('chat:send', (content: unknown, callback?: (result: object) => void) => {
      if (!currentStreamId) return callback?.({ success: false, code: 'NOT_IN_STREAM' })
      if (typeof content !== 'string' || !content.trim()) return callback?.({ success: false, code: 'INVALID_MESSAGE' })
      const trimmedContent = content.trim()
      if (trimmedContent.length > 500) return callback?.({ success: false, code: 'MESSAGE_TOO_LONG' })
      if (!consumeChatRateLimit(user.id)) return callback?.({ success: false, code: 'RATE_LIMITED' })
      const message = { id: randomUUID(), streamId: currentStreamId, userId: user.id, displayName: user.displayName, content: trimmedContent, createdAt: new Date().toISOString() }
      io.to(roomName(currentStreamId)).emit('chat:message', message)
      callback?.({ success: true, message })
    })

    socket.on('participant:request', (callback?: (result: object) => void) => {
      if (!currentStreamId) return callback?.({ success: false, code: 'NOT_IN_STREAM' })
      try {
        const request = participantManager.requestToJoin(currentStreamId, user)
        io.to(roomName(currentStreamId)).emit('participant:request-created', request)
        callback?.({ success: true, request })
      } catch (error) {
        callback?.({ success: false, code: error instanceof ParticipantError ? error.code : 'REQUEST_FAILED' })
      }
    })

    socket.on('participant:approve', (requestId: unknown, callback?: (result: object) => void) => {
      if (!currentStreamId) return callback?.({ success: false, code: 'NOT_IN_STREAM' })
      if (typeof requestId !== 'string') return callback?.({ success: false, code: 'REQUEST_NOT_FOUND' })
      try {
        const result = participantManager.approve(currentStreamId, requestId, user.id)
        io.to(roomName(currentStreamId)).emit('participant:approved', {
          requestId: result.request.id,
          participant: result.participant,
        })
        io.to(roomName(currentStreamId)).emit('stage:changed', {
          streamId: currentStreamId,
          participantId: result.participant.userId,
        })
        callback?.({ success: true })
      } catch (error) {
        callback?.({ success: false, code: error instanceof ParticipantError ? error.code : 'APPROVE_FAILED' })
      }
    })

    socket.on('participant:reject', (requestId: unknown, callback?: (result: object) => void) => {
      if (!currentStreamId) return callback?.({ success: false, code: 'NOT_IN_STREAM' })
      if (typeof requestId !== 'string') return callback?.({ success: false, code: 'REQUEST_NOT_FOUND' })
      try {
        const request = participantManager.reject(currentStreamId, requestId, user.id)
        io.to(roomName(currentStreamId)).emit('participant:rejected', request)
        callback?.({ success: true })
      } catch (error) {
        callback?.({ success: false, code: error instanceof ParticipantError ? error.code : 'REJECT_FAILED' })
      }
    })

    socket.on('participant:remove', async (userId: unknown, callback?: (result: object) => void) => {
      if (!currentStreamId) return callback?.({ success: false, code: 'NOT_IN_STREAM' })
      if (typeof userId !== 'string') return callback?.({ success: false, code: 'PARTICIPANT_NOT_FOUND' })
      try {
        const participant = participantManager.removeGuest(currentStreamId, userId, user.id)
        io.to(roomName(currentStreamId)).emit('participant:removed', participant)
        const stream = await streamRepository.findById(currentStreamId)
        io.to(roomName(currentStreamId)).emit('stage:changed', {
          streamId: currentStreamId,
          participantId: participantManager.getStage(currentStreamId) ?? stream?.ownerId,
        })
        callback?.({ success: true })
      } catch (error) {
        callback?.({ success: false, code: error instanceof ParticipantError ? error.code : 'REMOVE_FAILED' })
      }
    })

    socket.on('stage:change', (participantId: unknown, callback?: (result: object) => void) => {
      if (!currentStreamId) return callback?.({ success: false, code: 'NOT_IN_STREAM' })
      if (typeof participantId !== 'string') return callback?.({ success: false, code: 'PARTICIPANT_NOT_FOUND' })
      try {
        const stage = participantManager.changeStage(currentStreamId, participantId, user.id)
        io.to(roomName(currentStreamId)).emit('stage:changed', stage)
        callback?.({ success: true, stage })
      } catch (error) {
        callback?.({
          success: false,
          code: error instanceof ParticipantError ? error.code : 'STAGE_CHANGE_FAILED',
        })
      }
    })

    socket.on('participant:leave-stage', async (callback?: (result: object) => void) => {
      if (!currentStreamId) return callback?.({ success: false, code: 'NOT_IN_STREAM' })
      try {
        const participant = participantManager.leaveStage(currentStreamId, user.id)
        io.to(roomName(currentStreamId)).emit('participant:removed', participant)
        const stream = await streamRepository.findById(currentStreamId)
        io.to(roomName(currentStreamId)).emit('stage:changed', {
          streamId: currentStreamId,
          participantId: participantManager.getStage(currentStreamId) ?? stream?.ownerId,
        })
        callback?.({ success: true })
      } catch (error) {
        callback?.({
          success: false,
          code: error instanceof ParticipantError ? error.code : 'LEAVE_STAGE_FAILED',
        })
      }
    })

    socket.on('presence:heartbeat', (callback?: (result: object) => void) => callback?.({ success: true }))
    socket.on('stream:leave', leaveStream)
    socket.on('disconnect', leaveStream)

    function leaveStream() {
      if (!currentStreamId) return
      const streamId = currentStreamId
      currentStreamId = undefined
      socket.leave(roomName(streamId))
      const participant = participantManager.leaveBySocket(streamId, socket.id)
      const streamPresence = presence.get(streamId)
      streamPresence?.delete(socket.id)
      if (streamPresence?.size === 0) presence.delete(streamId)
      socket.to(roomName(streamId)).emit('stream:participant-left', {
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
      })
      socket.to(roomName(streamId)).emit('presence:left', { userId: user.id })
      if (participant) {
        socket.to(roomName(streamId)).emit('participant:left', participant.participant)
        if (participant.wasGuest) {
          socket.to(roomName(streamId)).emit('participant:removed', participant.participant)
          void streamRepository
            .findById(streamId)
            .then((stream) => {
              io.to(roomName(streamId)).emit('stage:changed', {
                streamId,
                participantId: participantManager.getStage(streamId) ?? stream?.ownerId,
              })
            })
            .catch(() => undefined)
        }
      }
      io.to(roomName(streamId)).emit('presence:count', { viewerCount: streamPresence?.size ?? 0 })
    }

    function consumeChatRateLimit(userId: string) {
      const now = Date.now()
      const timestamps = (chatRateLimits.get(userId) ?? []).filter(
        (timestamp) => now - timestamp < CHAT_RATE_LIMIT_WINDOW_MS,
      )
      if (timestamps.length >= CHAT_RATE_LIMIT_MAX_MESSAGES) {
        chatRateLimits.set(userId, timestamps)
        return false
      }
      timestamps.push(now)
      chatRateLimits.set(userId, timestamps)
      return true
    }
  })

  return io
}

export function notifyStreamEnded(io: Server, streamId: string) {
  io.to(roomName(streamId)).emit('stream:ended', { streamId })
}

export function getSocketCorsOrigins(frontendOrigin = process.env.FRONTEND_ORIGIN) {
  const configuredOrigins = frontendOrigin
    ? frontendOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://127.0.0.1:5173']
  const localAliases = configuredOrigins.flatMap((origin) => {
    if (origin === 'http://localhost:5173') return ['http://127.0.0.1:5173']
    if (origin === 'http://127.0.0.1:5173') return ['http://localhost:5173']
    return []
  })
  return [...new Set([...configuredOrigins, ...localAliases])]
}

function roomName(streamId: string) {
  return `stream:${streamId}`
}