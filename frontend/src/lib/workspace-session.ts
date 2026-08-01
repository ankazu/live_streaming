import type { Stream } from '../types/stream'

const workspaceSessionKey = 'live-streaming.workspace'
type WorkspaceMode = 'host' | 'viewer'
export interface WorkspaceSession {
  mode: WorkspaceMode
  stream: Stream
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | Map<string, string>

export function readWorkspaceSession(
  storage: StorageLike = window.sessionStorage,
): WorkspaceSession | null {
  const raw = getItem(storage, workspaceSessionKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceSession>
    if (
      (parsed.mode !== 'host' && parsed.mode !== 'viewer') ||
      !parsed.stream ||
      typeof parsed.stream !== 'object' ||
      typeof parsed.stream.joinCode !== 'string' ||
      parsed.stream.status !== 'live'
    ) {
      return null
    }
    return parsed as WorkspaceSession
  } catch {
    return null
  }
}

export function writeWorkspaceSession(storage: StorageLike, mode: WorkspaceMode, stream: Stream) {
  setItem(storage, workspaceSessionKey, JSON.stringify({ mode, stream }))
}

export function clearWorkspaceSession(storage: StorageLike = window.sessionStorage) {
  removeItem(storage, workspaceSessionKey)
}

function getItem(storage: StorageLike, key: string) {
  return storage instanceof Map ? (storage.get(key) ?? null) : storage.getItem(key)
}

function setItem(storage: StorageLike, key: string, value: string) {
  if (storage instanceof Map) storage.set(key, value)
  else storage.setItem(key, value)
}

function removeItem(storage: StorageLike, key: string) {
  if (storage instanceof Map) storage.delete(key)
  else storage.removeItem(key)
}
