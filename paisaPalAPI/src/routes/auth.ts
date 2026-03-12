import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { requireAuth } from '../middleware/auth'
import { connectDB } from '../lib/mongodb'

const router = Router()

const SALT_ROUNDS = 12
const JWT_EXPIRY = '7d'

interface RegisterBody {
  email: string
  password: string
  name: string
}

interface LoginBody {
  email: string
  password: string
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    await connectDB()

    const { email, password, name } = req.body as RegisterBody

    if (!email || !password || !name) {
      return res.status(400).json({ data: null, error: 'Email, password, and name are required' })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ data: null, error: 'Invalid email format' })
    }

    if (password.length < 8) {
      return res.status(400).json({ data: null, error: 'Password must be at least 8 characters' })
    }

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return res.status(409).json({ data: null, error: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: name.trim(),
    })

    const secret = process.env.JWT_SECRET
    if (!secret || secret.length < 32) {
      return res.status(500).json({ data: null, error: 'Server configuration error' })
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      secret,
      { expiresIn: JWT_EXPIRY }
    )

    return res.status(201).json({
      data: {
        user: { _id: user._id, email: user.email, name: user.name },
        token,
      },
      error: null,
    })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ data: null, error: 'Failed to register user' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    await connectDB()

    const { email, password } = req.body as LoginBody

    if (!email || !password) {
      return res.status(400).json({ data: null, error: 'Email and password are required' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')

    if (!user || !user.passwordHash) {
      return res.status(401).json({ data: null, error: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)

    if (!valid) {
      return res.status(401).json({ data: null, error: 'Invalid email or password' })
    }

    const secret = process.env.JWT_SECRET
    if (!secret || secret.length < 32) {
      return res.status(500).json({ data: null, error: 'Server configuration error' })
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      secret,
      { expiresIn: JWT_EXPIRY }
    )

    return res.json({
      data: {
        user: { _id: user._id, email: user.email, name: user.name },
        token,
      },
      error: null,
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ data: null, error: 'Failed to login' })
  }
})

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    await connectDB()

    const user = await User.findById(req.user!.userId)
    if (!user) {
      return res.status(404).json({ data: null, error: 'User not found' })
    }
    return res.json({
      data: { _id: user._id, email: user.email, name: user.name },
      error: null,
    })
  } catch (err) {
    console.error('Get me error:', err)
    return res.status(500).json({ data: null, error: 'Failed to get user' })
  }
})

router.post('/logout', (_req: Request, res: Response) => {
  return res.json({ data: { message: 'Logged out successfully' }, error: null })
})

export default router
