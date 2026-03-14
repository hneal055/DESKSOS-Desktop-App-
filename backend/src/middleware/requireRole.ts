import { Request, Response, NextFunction } from "express";

/**
 * Middleware that checks req.user.role against the allowed roles.
 * Must be used AFTER the auth() middleware (which populates req.user).
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}
