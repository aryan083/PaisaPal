import type { Request, Response } from 'express';

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    data: null,
    error: `Not found: ${req.method} ${req.originalUrl}`,
    errorCode: 'NOT_FOUND',
    suggestion: 'Please refresh the page or check the URL and try again.',
    requestId: req.requestId,
  });
};
