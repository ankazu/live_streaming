import { describe, expect, it } from 'vitest'

import { localVideoPreviewSize, localVideoPreviewStyle } from './livekit-layout'

describe('LiveKit video layout', () => {
  it('keeps the local preview at 120 by 80 pixels', () => {
    expect(localVideoPreviewSize).toEqual({ width: '120px', height: '80px' })
    expect(localVideoPreviewStyle).toEqual({ width: '120px', height: '80px' })
  })
})
