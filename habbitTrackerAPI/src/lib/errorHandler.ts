import type { ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'

type MongoErrorLike = {
  code?: number
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    console.error(err)
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      data: null,
      error: 'Invalid id format',
      errorCode: 'INVALID_ID',
    })
    return
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(422).json({
      data: null,
      error: 'Validation error',
      errorCode: 'VALIDATION_ERROR',
      ...(isProduction ? {} : { details: err.message }),
    })
    return
  }

  const mongoError = err as MongoErrorLike
  if (mongoError?.code === 11000) {
    res.status(409).json({
      data: null,
      error: 'Duplicate key error',
      errorCode: 'DUPLICATE',
    })
    return
  }

  res.status(500).json({
    data: null,
    error: 'Internal server error',
    errorCode: 'INTERNAL',
    ...(isProduction ? {} : { details: (err as Error).message }),
  })
}
