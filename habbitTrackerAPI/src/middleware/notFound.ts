import { Request, Response } from 'express'

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    data: null,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    errorCode: 'NOT_FOUND',
  })
}
