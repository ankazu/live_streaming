import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import type { UserRepository } from './repository.js'

const scrypt = promisify(scryptCallback)

export type UserRole = 'admin' | 'user'
export type AccountStatus = 'active' | 'pending' | 'suspended'

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  displayName: string
  role: UserRole
  accountStatus: AccountStatus
  createdAt: string
}

export interface PublicUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  accountStatus: AccountStatus
  createdAt: string
}

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user
  return publicUser
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  const storedKey = Buffer.from(key, 'hex')
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
}

export class UserStore implements UserRepository {
  private readonly users = new Map<string, UserRecord>()

  async create(input: { email: string; password: string; displayName: string; role?: Exclude<UserRole, 'admin'> }) {
    const email = input.email.trim().toLowerCase()
    if (await this.findByEmail(email)) throw new Error('EMAIL_EXISTS')

    const user: UserRecord = {
      id: randomUUID(),
      email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName.trim(),
      role: input.role ?? 'user',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
    }
    this.users.set(user.id, user)
    return user
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email.trim().toLowerCase())
  }

  async findById(id: string) {
    return this.users.get(id)
  }

  async setAccountStatus(id: string, accountStatus: AccountStatus) {
    const user = await this.findById(id)
    if (!user) throw new Error('USER_NOT_FOUND')
    user.accountStatus = accountStatus
    return user
  }
}
