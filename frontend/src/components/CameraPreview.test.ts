import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CameraPreview from './CameraPreview.vue'

describe('CameraPreview', () => {
  const getUserMedia = vi.fn()
  const microphoneTrack = { stop: vi.fn() }
  const microphoneStream = {
    getTracks: () => [microphoneTrack],
  } as unknown as MediaStream

  beforeEach(() => {
    getUserMedia.mockReset()
    microphoneTrack.stop.mockReset()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
  })

  it('shows camera and microphone controls next to each other', () => {
    const wrapper = mount(CameraPreview)

    expect(wrapper.get('[data-testid="toggle-camera"]').attributes('aria-label')).toBe(
      '開啟鏡頭預覽',
    )
    expect(wrapper.get('[data-testid="toggle-microphone"]').attributes('aria-label')).toBe(
      '開啟麥克風',
    )
    expect(wrapper.get('[data-testid="toggle-camera"]').find('svg').exists()).toBe(true)
    expect(wrapper.get('[data-testid="toggle-microphone"]').find('svg').exists()).toBe(true)
  })

  it('requests and releases the microphone independently from the camera', async () => {
    getUserMedia.mockResolvedValue(microphoneStream)
    const wrapper = mount(CameraPreview)

    await wrapper.get('[data-testid="toggle-microphone"]').trigger('click')

    expect(getUserMedia).toHaveBeenCalledWith({ video: false, audio: true })
    expect(wrapper.get('[data-testid="toggle-microphone"]').attributes('aria-label')).toBe(
      '關閉麥克風',
    )

    await wrapper.get('[data-testid="toggle-microphone"]').trigger('click')
    expect(microphoneTrack.stop).toHaveBeenCalledOnce()
  })
})
