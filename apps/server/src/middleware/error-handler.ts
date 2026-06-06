import type { NextFunction, Request, Response } from "express";
import { redactSecrets } from "../lib/redaction.js";

export type HttpError = Error & { statusCode?: number; code?: string; details?: unknown };

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "not_found", message: "Not found" } });
}

export function errorHandler(error: HttpError, _req: Request, res: Response, _next: NextFunction) {
  const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
  res.status(status).json({
    error: {
      code: error.code ?? (status === 500 ? "internal_error" : "request_error"),
      message: status === 500 ? "Internal server error" : redactSecrets(error.message),
      ...(error.details === undefined ? {} : { details: redactSecrets(error.details) }),
    },
  });
}
