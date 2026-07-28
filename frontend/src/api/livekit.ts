import { apiClient } from './client'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export interface LiveKitTokenResponse {
  token: string
  url: string
  roomName: string
  canPublish: boolean
}

export async function getLiveKitToken(streamId: string) {
  const response = await apiClient.post<ApiEnvelope<LiveKitTokenResponse>>('/livekit/token', {
    streamId,
  })
  return response.data.data
}
