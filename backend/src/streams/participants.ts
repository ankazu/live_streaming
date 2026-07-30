import { randomUUID } from 'node:crypto'

export type ParticipantRole = 'host' | 'viewer' | 'guest'
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type Participant = {
  userId: string
  displayName: string
  role: ParticipantRole
  socketId: string
  joinedAt: string
}

export type ParticipantRequest = {
  id: string
  streamId: string
  userId: string
  displayName: string
  status: JoinRequestStatus
  createdAt: string
}

export class ParticipantError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

export class ParticipantManager {
  private readonly participants = new Map<string, Map<string, Participant>>()
  private readonly requests = new Map<string, Map<string, ParticipantRequest>>()
  private readonly stages = new Map<string, string>()

  join(streamId: string, user: { id: string; displayName: string }, socketId: string, isHost: boolean) {
    const streamParticipants = this.participants.get(streamId) ?? new Map<string, Participant>()
    const participant: Participant = {
      userId: user.id,
      displayName: user.displayName,
      role: isHost ? 'host' : 'viewer',
      socketId,
      joinedAt: new Date().toISOString(),
    }
    streamParticipants.set(user.id, participant)
    this.participants.set(streamId, streamParticipants)
    return participant
  }

  leaveBySocket(streamId: string, socketId: string) {
    const streamParticipants = this.participants.get(streamId)
    const participant = [...(streamParticipants?.values() ?? [])].find((item) => item.socketId === socketId)
    if (!participant) return undefined
    streamParticipants?.delete(participant.userId)
    if (streamParticipants?.size === 0) this.participants.delete(streamId)
    this.cancelPendingRequest(streamId, participant.userId)
    return participant
  }

  requestToJoin(streamId: string, user: { id: string; displayName: string }) {
    const participant = this.getParticipant(streamId, user.id)
    if (!participant) throw new ParticipantError('PARTICIPANT_NOT_FOUND')
    if (participant.role !== 'viewer') throw new ParticipantError('REQUEST_NOT_ALLOWED')

    const streamRequests = this.requests.get(streamId) ?? new Map<string, ParticipantRequest>()
    const pending = [...streamRequests.values()].find(
      (request) => request.userId === user.id && request.status === 'pending',
    )
    if (pending) throw new ParticipantError('REQUEST_ALREADY_PENDING')

    const request: ParticipantRequest = {
      id: randomUUID(),
      streamId,
      userId: user.id,
      displayName: user.displayName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    streamRequests.set(request.id, request)
    this.requests.set(streamId, streamRequests)
    return request
  }

  approve(streamId: string, requestId: string, actorId: string) {
    this.assertHost(streamId, actorId)
    const request = this.getPendingRequest(streamId, requestId)
    const guestCount = [...(this.participants.get(streamId)?.values() ?? [])].filter(
      (participant) => participant.role === 'guest',
    ).length
    if (guestCount >= 1) throw new ParticipantError('GUEST_LIMIT_REACHED')

    const participant = this.getParticipant(streamId, request.userId)
    if (!participant) throw new ParticipantError('PARTICIPANT_NOT_FOUND')
    participant.role = 'guest'
    request.status = 'approved'
    this.stages.set(streamId, request.userId)
    return { request, participant }
  }

  reject(streamId: string, requestId: string, actorId: string) {
    this.assertHost(streamId, actorId)
    const request = this.getPendingRequest(streamId, requestId)
    request.status = 'rejected'
    return request
  }

  removeGuest(streamId: string, userId: string, actorId: string) {
    this.assertHost(streamId, actorId)
    const participant = this.getParticipant(streamId, userId)
    if (!participant) throw new ParticipantError('PARTICIPANT_NOT_FOUND')
    if (participant.role !== 'guest') throw new ParticipantError('PARTICIPANT_NOT_GUEST')
    participant.role = 'viewer'
    if (this.stages.get(streamId) === userId) this.stages.delete(streamId)
    return participant
  }

  changeStage(streamId: string, participantId: string, actorId: string) {
    this.assertHost(streamId, actorId)
    const participant = this.getParticipant(streamId, participantId)
    if (!participant || (participant.role !== 'host' && participant.role !== 'guest')) {
      throw new ParticipantError('PARTICIPANT_NOT_FOUND')
    }
    this.stages.set(streamId, participantId)
    return { streamId, participantId }
  }

  leaveStage(streamId: string, userId: string) {
    const participant = this.getParticipant(streamId, userId)
    if (!participant || participant.role !== 'guest') throw new ParticipantError('PARTICIPANT_NOT_GUEST')
    participant.role = 'viewer'
    if (this.stages.get(streamId) === userId) this.stages.delete(streamId)
    return participant
  }

  getStage(streamId: string) {
    return this.stages.get(streamId)
  }

  getParticipant(streamId: string, userId: string) {
    return this.participants.get(streamId)?.get(userId)
  }

  getPendingRequests(streamId: string) {
    return [...(this.requests.get(streamId)?.values() ?? [])].filter((request) => request.status === 'pending')
  }

  private assertHost(streamId: string, actorId: string) {
    const actor = this.getParticipant(streamId, actorId)
    if (!actor || actor.role !== 'host') throw new ParticipantError('NOT_HOST')
  }

  private getPendingRequest(streamId: string, requestId: string) {
    const request = this.requests.get(streamId)?.get(requestId)
    if (!request || request.status !== 'pending') throw new ParticipantError('REQUEST_NOT_FOUND')
    return request
  }

  private cancelPendingRequest(streamId: string, userId: string) {
    const request = [...(this.requests.get(streamId)?.values() ?? [])].find(
      (item) => item.userId === userId && item.status === 'pending',
    )
    if (request) request.status = 'cancelled'
  }
}
