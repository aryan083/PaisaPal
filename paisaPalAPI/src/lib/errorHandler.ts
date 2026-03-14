import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';

type MongoErrorLike = {
  code?: number;
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error(err);
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      data: null,
      error: 'Invalid id format',
      errorCode: 'INVALID_ID',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
      ...(isProduction ? {} : { details: err.message }),
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(422).json({
      data: null,
      error: 'Validation error',
      errorCode: 'VALIDATION_ERROR',
      suggestion: 'Please check your inputs and try again.',
      requestId: req.requestId,
      ...(isProduction ? {} : { details: err.message }),
    });
  }

  const mongoError = err as MongoErrorLike;
  if (mongoError?.code === 11000) {
    return res.status(409).json({
      data: null,
      error: 'Duplicate key error',
      errorCode: 'DUPLICATE',
      suggestion: 'This item already exists. Try changing the values and retry.',
      requestId: req.requestId,
      ...(isProduction ? {} : { details: (err as Error).message }),
    });
  }

  return res.status(500).json({
    data: null,
    error: 'Internal server error',
    errorCode: 'INTERNAL',
    suggestion: 'Please try again later.',
    requestId: req.requestId,
    ...(isProduction ? {} : { details: (err as Error).message }),
  });
};
