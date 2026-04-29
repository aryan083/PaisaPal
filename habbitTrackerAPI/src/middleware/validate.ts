import type { NextFunction, Request, Response } from 'express'
import type { ZodSchema } from 'zod'

type ValidationTarget = 'body' | 'query'

export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const toValidate = target === 'body' ? req.body : req.query
    const result = schema.safeParse(toValidate)

    if (!result.success) {
      const flat = result.error.flatten()
      const fieldErrors: Record<string, string[]> = {}
      for (const [key, value] of Object.entries(flat.fieldErrors)) {
        if (value && value.length > 0) {
          fieldErrors[key] = value as string[]
        }
      }
      res.status(400).json({
        data: null,
        error: 'Validation failed',
        errorCode: 'VALIDATION_FAILED',
        details: flat,
        fieldErrors,
      })
      return
    }

    if (target === 'body') {
      req.body = result.data
    } else {
      if (typeof req.query === 'object' && req.query !== null) {
        for (const key of Object.keys(req.query)) {
          Reflect.deleteProperty(req.query as Record<string, unknown>, key)
        }
        Object.assign(req.query as Record<string, unknown>, result.data)
      }
    }

    next()
  }
}
