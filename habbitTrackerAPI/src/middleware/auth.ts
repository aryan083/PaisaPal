import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthUser {
  userId: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      requestId?: string
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      data: null,
      error: 'Authentication required',
      errorCode: 'AUTH_REQUIRED',
    })
    return
  }

  const token = authHeader.split(' ')[1]

  if (!token) {
    res.status(401).json({ data: null, error: 'Authentication required', errorCode: 'AUTH_REQUIRED' })
    return
  }

  const secret = process.env.JWT_SECRET

  if (!secret || secret.length < 32) {
    console.error('JWT_SECRET not configured or too short')
    res.status(500).json({ data: null, error: 'Server configuration error', errorCode: 'SERVER_CONFIG_ERROR' })
    return
  }

  try {
    const decoded = jwt.verify(token, secret) as { userId: string; email: string; iat: number; exp: number }
    req.user = { userId: decoded.userId, email: decoded.email }
    next()
  } catch {
    res.status(401).json({ data: null, error: 'Invalid or expired token', errorCode: 'TOKEN_INVALID' })
  }
}
