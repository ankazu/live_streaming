import type { AccountStatus, UserRecord, UserRole } from './store.js'

export interface UserRepository {
  create(input: {
    email: string
    password: string
    displayName: string
    role?: Exclude<UserRole, 'admin'>
  }): Promise<UserRecord>
  findByEmail(email: string): Promise<UserRecord | undefined>
  findById(id: string): Promise<UserRecord | undefined>
  setAccountStatus(id: string, accountStatus: AccountStatus): Promise<UserRecord>
}