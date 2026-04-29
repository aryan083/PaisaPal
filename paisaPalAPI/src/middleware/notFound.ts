import type { Request, Response } from 'express';

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    data: null,
    error: `Not found: ${req.method} ${req.originalUrl}`,
  });
};
