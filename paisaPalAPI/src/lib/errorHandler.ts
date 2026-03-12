import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';

type MongoErrorLike = {
  code?: number;
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error(err);
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      data: null,
      error: 'Invalid id format',
      ...(isProduction ? {} : { details: err.message }),
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(422).json({
      data: null,
      error: 'Validation error',
      ...(isProduction ? {} : { details: err.message }),
    });
  }

  const mongoError = err as MongoErrorLike;
  if (mongoError?.code === 11000) {
    return res.status(409).json({
      data: null,
      error: 'Duplicate key error',
      ...(isProduction ? {} : { details: (err as Error).message }),
    });
  }

  return res.status(500).json({
    data: null,
    error: 'Internal server error',
    ...(isProduction ? {} : { details: (err as Error).message }),
  });
};
