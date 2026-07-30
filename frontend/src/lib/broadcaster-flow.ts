import type { CreateStreamInput } from '../api/streams'
import type { Stream } from '../types/stream'

export async function createAndStartStream(
  input: CreateStreamInput,
  create: (input: CreateStreamInput) => Promise<Stream>,
  start: (id: string) => Promise<Stream>,
) {
  const createdStream = await create(input)
  return start(createdStream.id)
}
