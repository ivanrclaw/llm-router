import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Download-Options": "noopen",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-XSS-Protection": "0",
};

function configuredOrigins(): string[] | null {
  const raw = process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS ?? "";
  const origins = raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins.length > 0 ? origins : null;
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
  });
  helmetMiddleware(_req, res, () => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
    next();
  });
}

export function configuredCors() {
  return cors({
    origin(origin, callback) {
      const origins = configuredOrigins();
      if (!origin || !origins) {
        callback(null, !origin || true);
        return;
      }
      callback(null, origins.includes(origin));
    },
  });
}
