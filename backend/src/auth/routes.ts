import { Router } from 'express'

import { requireAuth, type AuthenticatedRequest } from './middleware.js'
import type { UserRepository } from './repository.js'
import { createAccessToken } from './token.js'
import { toPublicUser, UserStore, verifyPassword } from './store.js'

const publicRoles = new Set(['viewer', 'broadcaster'])

export function createAuthRouter(userRepository: UserRepository = new UserStore()) {
  const router = Router()

  router.post('/register', async (request, response) => {
    const { email, password, displayName, role } = request.body ?? {}

    if (!email || !password || !displayName || typeof email !== 'string' || typeof password !== 'string' || typeof displayName !== 'string') {
      response.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'email, password, and displayName are required' })
      return
    }
    if (typeof role !== 'string' || !publicRoles.has(role)) {
      response.status(400).json({ success: false, code: 'INVALID_ROLE', message: 'Only viewer or broadcaster registration is allowed' })
      return
    }
    if (password.length < 8) {
      response.status(400).json({ success: false, code: 'INVALID_PASSWORD', message: 'Password must be at least 8 characters' })
      return
    }

    try {
      const user = await userRepository.create({ email, password, displayName, role: role as 'viewer' | 'broadcaster' })
      response.status(201).json({ success: true, data: { user: toPublicUser(user), accessToken: await createAccessToken(user.id) } })
    } catch (error) {
      if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
        response.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'Email is already registered' })
        return
      }
      throw error
    }
  })

  router.post('/login', async (request, response) => {
    const { email, password } = request.body ?? {}
    const user = typeof email === 'string' ? await userRepository.findByEmail(email) : undefined
    if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.passwordHash))) {
      response.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' })
      return
    }
    if (user.accountStatus === 'suspended') {
      response.status(403).json({ success: false, code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' })
      return
    }

    response.json({ success: true, data: { user: toPublicUser(user), accessToken: await createAccessToken(user.id) } })
  })

  router.get('/me', requireAuth(userRepository), async (request: AuthenticatedRequest, response) => {
    const user = await userRepository.findById(request.userId!)
    response.json({ success: true, data: { user: toPublicUser(user!) } })
  })

  return { router, userRepository }
}
