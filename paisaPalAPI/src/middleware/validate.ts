import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query';

export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const toValidate = target === 'body' ? req.body : req.query;
    const result = schema.safeParse(toValidate);

    if (!result.success) {
      const flat = result.error.flatten();
      const fieldErrors: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(flat.fieldErrors)) {
        if (value && value.length > 0) {
          fieldErrors[key] = value;
        }
      }
      // Debug aid: echo back which top-level keys actually arrived (keys only,
      // never values) so clients like iOS Shortcuts can see when a field was
      // dropped or misnamed before it reached validation.
      const receivedKeys =
        typeof toValidate === 'object' && toValidate !== null ? Object.keys(toValidate) : [];
      // TEMP-DEBUG-INGEST (remove after Rapido live verify): log the SHAPE of
      // rejected payloads — keys, value types, string lengths only, never
      // values — so iPhone automation failures can be diagnosed from Vercel
      // logs, where the Shortcut result JSON is invisible. Presence of this
      // log line also proves the new code is what's serving.
      try {
        const shape: Record<string, string> = {};
        if (typeof toValidate === 'object' && toValidate !== null) {
          for (const [k, v] of Object.entries(toValidate as Record<string, unknown>)) {
            shape[k] = typeof v === 'string' ? `string(len=${v.length})` : typeof v;
          }
        }
        console.log(
          `[ingest-debug] url=${req.method} ${req.url} fieldErrors=${JSON.stringify(fieldErrors)} shape=${JSON.stringify(shape)}`,
        );
      } catch {
        // Logging must never break validation.
      }
      return res.status(400).json({
        data: null,
        error: 'Validation failed',
        errorCode: 'VALIDATION_FAILED',
        suggestion: 'Please fix the highlighted fields and try again.',
        requestId: req.requestId,
        details: flat,
        fieldErrors,
        receivedKeys,
      });
    }

    if (target === 'body') {
      req.body = result.data;
    } else {
      if (typeof req.query === 'object' && req.query !== null) {
        for (const key of Object.keys(req.query)) {
          Reflect.deleteProperty(req.query as Record<string, unknown>, key);
        }
        Object.assign(req.query as Record<string, unknown>, result.data);
      }
    }

    next();
  };
};
