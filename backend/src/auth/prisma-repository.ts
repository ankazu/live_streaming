import { PrismaClient } from '@prisma/client'

import { hashPassword, type AccountStatus, type UserRecord, type UserRole } from './store.js'
import type { UserRepository } from './repository.js'

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: {
    email: string
    password: string
    displayName: string
    role: Exclude<UserRole, 'admin'>
  }): Promise<UserRecord> {
    try {
      const user = await this.db.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          passwordHash: await hashPassword(input.password),
          displayName: input.displayName.trim(),
          role: input.role,
          accountStatus: input.role === 'broadcaster' ? 'pending' : 'active',
        },
      })
      return toUserRecord(user)
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new Error('EMAIL_EXISTS')
      throw error
    }
  }

  async findByEmail(email: string) {
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    return user ? toUserRecord(user) : undefined
  }

  async findById(id: string) {
    const user = await this.db.user.findUnique({ where: { id } })
    return user ? toUserRecord(user) : undefined
  }

  async setAccountStatus(id: string, accountStatus: AccountStatus) {
    try {
      const user = await this.db.user.update({ where: { id }, data: { accountStatus } })
      return toUserRecord(user)
    } catch (error) {
      if (isRecordNotFoundError(error)) throw new Error('USER_NOT_FOUND')
      throw error
    }
  }
}

function toUserRecord(user: {
  id: string
  email: string
  passwordHash: string
  displayName: string
  role: string
  accountStatus: string
  createdAt: Date
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    role: user.role as UserRole,
    accountStatus: user.accountStatus as AccountStatus,
    createdAt: user.createdAt.toISOString(),
  }
}

function isUniqueConstraintError(error: unknown) {
  return isPrismaError(error, 'P2002')
}

function isRecordNotFoundError(error: unknown) {
  return isPrismaError(error, 'P2025')
}

function isPrismaError(error: unknown, code: string): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
