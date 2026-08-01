import { describe, expect, it } from 'vitest'

import { stageVideoClass } from '../../src/lib/livekit-layout'

describe('LiveKit video layout', () => {
  it('uses a full video surface for the selected participant without picture-in-picture', () => {
    expect(stageVideoClass()).toContain('inset-0')
    expect(stageVideoClass()).not.toContain('right-3')
  })
})
