import { apiClient } from './client'
import type { Stream, StreamStatus } from '../types/stream'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export interface CreateStreamInput {
  title: string
  description?: string
}

export async function getStreams() {
  const response = await apiClient.get<ApiEnvelope<{ items: Stream[] }>>('/streams')
  return response.data.data.items
}

export async function createStream(input: CreateStreamInput) {
  const response = await apiClient.post<ApiEnvelope<{ stream: Stream }>>('/streams', input)
  return response.data.data.stream
}

export async function startStream(id: string) {
  const response = await apiClient.post<ApiEnvelope<{ stream: Stream }>>(`/streams/${id}/start`)
  return response.data.data.stream
}

export async function endStream(id: string) {
  const response = await apiClient.post<ApiEnvelope<{ stream: Stream }>>(`/streams/${id}/end`)
  return response.data.data.stream
}

export type { StreamStatus }
