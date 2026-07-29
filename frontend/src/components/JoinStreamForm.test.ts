import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import JoinStreamForm from './JoinStreamForm.vue'
import { getStreamByJoinCode } from '../api/streams'

vi.mock('../api/streams', () => ({
  getStreamByJoinCode: vi.fn(),
}))

const mockedGetStreamByJoinCode = vi.mocked(getStreamByJoinCode)

const liveStream = {
  id: 'stream-1',
  joinCode: '482731',
  title: '測試直播',
  description: '',
  status: 'live' as const,
  broadcasterId: 'broadcaster-1',
  viewerCount: 2,
  createdAt: '2026-07-29T00:00:00.000Z',
}

describe('JoinStreamForm', () => {
  beforeEach(() => mockedGetStreamByJoinCode.mockClear())

  it('resolves a six-digit code only after confirmation', async () => {
    mockedGetStreamByJoinCode.mockResolvedValue(liveStream)
    const wrapper = mount(JoinStreamForm)

    await wrapper.get('input').setValue('482731')
    expect(mockedGetStreamByJoinCode).not.toHaveBeenCalled()

    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(mockedGetStreamByJoinCode).toHaveBeenCalledWith('482731'))
    expect(wrapper.emitted('watchLive')?.[0]).toEqual([liveStream])
  })

  it('rejects codes that are not six digits without calling the API', async () => {
    const wrapper = mount(JoinStreamForm)

    await wrapper.get('input').setValue('123')
    await wrapper.get('form').trigger('submit')

    expect(mockedGetStreamByJoinCode).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('6 位數')
  })

  it('renders a confirmation button below the code input', () => {
    const wrapper = mount(JoinStreamForm)

    expect(wrapper.get('button').text()).toContain('確認')
  })
})
