import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import pino, { Logger } from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

const logger: Logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
})

export type { Logger }

export const log = logger

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID()
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)

  const startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - startTime
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      userId: req.user?.userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }

    if (res.statusCode >= 500) {
      log.error(logData, 'Request completed with server error')
      return
    }

    if (res.statusCode >= 400) {
      log.info(logData, 'Request completed with client error')
      return
    }

    log.info(logData, 'Request completed')
  })

  next()
}

export function logInfo(message: string, data?: Record<string, unknown>): void {
  log.info(data ?? {}, message)
}

export function logError(message: string, error?: Error, data?: Record<string, unknown>): void {
  log.error({ ...data, error: error?.message, stack: error?.stack }, message)
}

export function logWarn(message: string, data?: Record<string, unknown>): void {
  log.warn(data ?? {}, message)
}

export function logDebug(message: string, data?: Record<string, unknown>): void {
  log.debug(data ?? {}, message)
}
