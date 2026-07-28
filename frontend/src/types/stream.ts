export type StreamStatus = 'scheduled' | 'live' | 'ended'

export interface Stream {
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
