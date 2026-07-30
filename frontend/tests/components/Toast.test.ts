import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import ToastContainer from '../../src/components/ToastContainer.vue'
import { useToast } from '../../src/composables/useToast'

describe('toast notifications', () => {
  beforeEach(() => {
    const { toasts, dismissToast } = useToast()
    for (const toast of toasts.value) dismissToast(toast.id)
  })

  it('adds an info toast and removes it by id', () => {
    const { toasts, showToast, dismissToast } = useToast()

    const toast = showToast('申請中，請稍候。', 'info')

    expect(toasts.value).toContainEqual(
      expect.objectContaining({
        id: toast.id,
        message: '申請中，請稍候。',
        type: 'info',
      }),
    )

    dismissToast(toast.id)
    expect(toasts.value).not.toContainEqual(expect.objectContaining({ id: toast.id }))
  })

  it('renders toast content and exposes a dismiss button', async () => {
    const { showToast } = useToast()
    showToast('發生錯誤，請稍後再試。', 'error')

    const wrapper = mount(ToastContainer)

    expect(wrapper.text()).toContain('發生錯誤，請稍後再試。')
    expect(wrapper.get('[data-testid="toast-error"]')).toBeTruthy()

    await wrapper.get('[data-testid="toast-dismiss"]').trigger('click')
    expect(wrapper.text()).not.toContain('發生錯誤，請稍後再試。')
  })

  it('announces errors assertively and regular updates politely', () => {
    const { showToast } = useToast()
    showToast('發生錯誤，請稍後再試。', 'error')
    showToast('申請中，請稍候。', 'info')

    const wrapper = mount(ToastContainer)

    expect(wrapper.get('[data-testid="toast-error"]').attributes('role')).toBe('alert')
    expect(wrapper.get('[data-testid="toast-info"]').attributes('role')).toBe('status')
  })
})
