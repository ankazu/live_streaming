import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LiveKitRoom from './LiveKitRoom.vue'
import componentSource from './LiveKitRoom.vue?raw'

describe('LiveKitRoom', () => {
  it('does not render a duplicate chat panel', () => {
    const wrapper = mount(LiveKitRoom, {
      props: { streamId: 'stream-1', title: '測試直播' },
    })

    expect(wrapper.find('input[placeholder="Say something…"]').exists()).toBe(false)
    expect(componentSource).not.toContain('聊天室')
  })
})
