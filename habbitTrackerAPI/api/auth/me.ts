import type { VercelRequest, VercelResponse } from '@vercel/node'
import app from '../../src/index'

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Inject path for Express routing
  ;(req as unknown as { url: string }).url = '/api/auth/me'
  return app(req as unknown as Parameters<typeof app>[0], res as unknown as Parameters<typeof app>[1])
}
