import { Request, Response, NextFunction } from "express";

const IS_PROD = process.env.NODE_ENV === "production";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the full error server-side so it shows up in logs/CI
  console.error(`[ERROR] ${err.message}`, IS_PROD ? "" : err.stack);

  // Never expose stack traces or internal messages to the client
  res.status(500).json({ error: "Internal server error" });
}
