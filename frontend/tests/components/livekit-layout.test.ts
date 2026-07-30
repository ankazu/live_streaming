import { describe, expect, it } from 'vitest'

import {
  localVideoPreviewSize,
  localVideoPreviewStyle,
  stageVideoClass,
} from '../../src/lib/livekit-layout'

describe('LiveKit video layout', () => {
  it('keeps the local preview at 120 by 80 pixels', () => {
    expect(localVideoPreviewSize).toEqual({ width: '120px', height: '80px' })
    expect(localVideoPreviewStyle).toEqual({ width: '120px', height: '80px' })
  })

  it('uses bounded stage and picture-in-picture classes for participants', () => {
    expect(stageVideoClass(true)).toContain('inset-0')
    expect(stageVideoClass(false)).toContain('right-3')
  })
})
