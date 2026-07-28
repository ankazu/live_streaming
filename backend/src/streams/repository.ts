import type { StreamRecord } from './store.js'

export interface StreamRepository {
  create(input: { title: string; description?: string; broadcasterId: string }): Promise<StreamRecord>
  list(): Promise<StreamRecord[]>
  findById(id: string): Promise<StreamRecord | undefined>
  start(id: string): Promise<StreamRecord>
  end(id: string): Promise<StreamRecord>
}