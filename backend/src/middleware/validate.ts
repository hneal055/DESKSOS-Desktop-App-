import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Returns an Express middleware that validates req.body against the given schema.
 * On failure returns 400 with a structured errors array.
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      res.status(400).json({ error: "Validation failed", errors });
      return;
    }
    req.body = result.data; // replace with coerced/defaulted values
    next();
  };
}

