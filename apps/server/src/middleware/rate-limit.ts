import type { NextFunction, Request, Response } from "express";
import { createHash } from "crypto";

const DEFAULT_AUTH_RPM = 20;
const DEFAULT_V1_RPM = 120;
const buckets = new Map<string, { windowStartMs: number; count: number }>();

function limitFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function clientKey(req: Request, scope: string): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const bearer = req.header("authorization") ?? "";
  return createHash("sha256").update(`${scope}:${ip}:${bearer}`).digest("hex");
}

export function rateLimit(options: { scope: string; rpmEnv: string; defaultRpm?: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const rpm = limitFromEnv(options.rpmEnv, options.defaultRpm ?? DEFAULT_V1_RPM);
    const key = clientKey(req, options.scope);
    const now = Date.now();
    const current = buckets.get(key);
    const sameWindow = !!current && now - current.windowStartMs < 60_000;
    const count = sameWindow ? current.count + 1 : 1;
    buckets.set(key, { windowStartMs: sameWindow ? current.windowStartMs : now, count });
    if (count > rpm) {
      res.status(429).json({ error: { code: "rate_limit_exceeded", message: "Rate limit exceeded" } });
      return;
    }
    next();
  };
}

export function authRateLimit() {
  return rateLimit({ scope: "auth", rpmEnv: "AUTH_RATE_LIMIT_RPM", defaultRpm: DEFAULT_AUTH_RPM });
}

export function v1RateLimit() {
  return rateLimit({ scope: "v1", rpmEnv: "V1_RATE_LIMIT_RPM", defaultRpm: DEFAULT_V1_RPM });
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
}
