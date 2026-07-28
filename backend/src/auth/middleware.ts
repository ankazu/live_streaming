import type { NextFunction, Request, Response } from 'express'

import { verifyAccessToken } from './token.js'
import type { UserRepository } from './repository.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
}

export function requireAuth(userRepository: UserRepository) {
  return async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    const authorization = request.header('authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined

    if (!token) {
      response.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' })
      return
    }

    try {
      const userId = await verifyAccessToken(token)
      if (!(await userRepository.findById(userId))) throw new Error('USER_NOT_FOUND')
      request.userId = userId
      next()
    } catch {
      response.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid or expired token' })
    }
  }
}
