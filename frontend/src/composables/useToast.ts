import { ref } from 'vue'

export type ToastType = 'info' | 'success' | 'error'

export type Toast = {
  id: number
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])
let nextToastId = 1

function dismissToast(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function showToast(message: string, type: ToastType = 'info', duration = 4000) {
  const toast = { id: nextToastId++, message, type }
  toasts.value.push(toast)

  if (duration > 0) {
    window.setTimeout(() => dismissToast(toast.id), duration)
  }

  return toast
}

export function useToast() {
  return { toasts, showToast, dismissToast }
}
