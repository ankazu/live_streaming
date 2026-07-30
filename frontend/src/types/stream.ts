export type StreamStatus = 'scheduled' | 'live' | 'ended'

export interface Stream {
  id: string
  joinCode: string
  title: string
  description: string
  status: StreamStatus

  ownerId: string
  viewerCount: number
  createdAt: string
  startedAt?: string
  endedAt?: string
}
