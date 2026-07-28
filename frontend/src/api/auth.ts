import { apiClient } from './client'
import type { AuthResponse, User, UserRole } from '../types/auth'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export interface RegisterInput {
  email: string
  password: string
  displayName: string
  role: Exclude<UserRole, 'admin'>
}

export interface LoginInput {
  email: string
  password: string
}

export async function register(input: RegisterInput) {
  const response = await apiClient.post<ApiEnvelope<AuthResponse>>('/auth/register', input)
  return response.data.data
}

export async function login(input: LoginInput) {
  const response = await apiClient.post<ApiEnvelope<AuthResponse>>('/auth/login', input)
  return response.data.data
}

export async function getCurrentUser() {
  const response = await apiClient.get<ApiEnvelope<{ user: User }>>('/auth/me')
  return response.data.data.user
}
