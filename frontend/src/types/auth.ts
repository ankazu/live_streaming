export type UserRole = 'admin' | 'broadcaster' | 'viewer'
export type AccountStatus = 'active' | 'pending' | 'suspended'

export interface User {
  id: string
  email: string
  displayName: string
  role: UserRole
  accountStatus: AccountStatus
  createdAt: string
}

export interface AuthResponse {
  user: User
  accessToken: string
}
