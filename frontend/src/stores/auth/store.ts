import { defineStore } from 'pinia'
import {
  getCurrentUser,
  login,
  register,
  type LoginInput,
  type RegisterInput,
} from '../../api/auth'
import type { User } from '../../types/auth'

const tokenKey = 'live-streaming.access-token'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    isLoading: false,
    isRestoring: false,
    error: null as string | null,
  }),
  getters: {
    isAuthenticated: (state) => state.user !== null,
  },
  actions: {
    clearError() {
      this.error = null
    },
    async register(input: RegisterInput) {
      return this.runAuthRequest(() => register(input))
    },
    async login(input: LoginInput) {
      return this.runAuthRequest(() => login(input))
    },
    async restoreSession() {
      this.isRestoring = true
      if (!localStorage.getItem(tokenKey)) {
        this.isRestoring = false
        return
      }
      try {
        this.user = await getCurrentUser()
      } catch {
        this.logout()
      } finally {
        this.isRestoring = false
      }
    },
    handleUnauthorized() {
      this.logout()
      this.error = '登入狀態已失效，請重新登入。'
    },
    logout() {
      localStorage.removeItem(tokenKey)
      this.user = null
    },
    async runAuthRequest(request: () => Promise<{ user: User; accessToken: string }>) {
      this.isLoading = true
      this.error = null
      try {
        const result = await request()
        localStorage.setItem(tokenKey, result.accessToken)
        this.user = result.user
        return true
      } catch (error: unknown) {
        this.error = getErrorMessage(error)
        return false
      } finally {
        this.isLoading = false
      }
    },
  },
})

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return '目前無法完成操作，請稍後再試。'
}
