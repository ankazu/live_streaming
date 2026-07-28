import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StreamGrid from './StreamGrid.vue'
import { getStreams } from '../api/streams'

vi.mock('../api/streams', () => ({
  getStreams: vi.fn(),
}))

const mockedGetStreams = vi.mocked(getStreams)

const streams = [
  {
    id: 'stream-1',
    title: '週末音樂現場',
    description: '音樂直播',
    status: 'live' as const,
    broadcasterId: 'user-1',
    viewerCount: 12,
    createdAt: '2026-07-28T00:00:00.000Z',
  },
  {
    id: 'stream-2',
    title: '一起做甜點',
    description: '生活直播',
    status: 'scheduled' as const,
    broadcasterId: 'user-2',
    viewerCount: 0,
    createdAt: '2026-07-28T00:00:00.000Z',
  },
]

describe('StreamGrid', () => {
  beforeEach(() => mockedGetStreams.mockResolvedValue(streams))

  it('renders streams returned by the API instead of static data', async () => {
    const wrapper = mount(StreamGrid)
    await vi.waitFor(() => expect(wrapper.text()).toContain('週末音樂現場'))

    expect(wrapper.text()).toContain('一起做甜點')
    expect(mockedGetStreams).toHaveBeenCalledOnce()
  })

  it('filters API streams by the search query', async () => {
    const wrapper = mount(StreamGrid, { props: { searchQuery: '甜點' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('一起做甜點'))

    expect(wrapper.text()).not.toContain('週末音樂現場')
  })
})
