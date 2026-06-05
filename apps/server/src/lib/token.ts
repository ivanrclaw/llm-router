import { createHmac, timingSafeEqual } from "crypto";

export type DashboardTokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  return "llm-router-development-auth-secret-change-me";
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(unsignedToken: string): string {
  return createHmac("sha256", getAuthSecret()).update(unsignedToken).digest("base64url");
}

export function createDashboardToken(payload: Omit<DashboardTokenPayload, "exp">, ttlSeconds = 60 * 60 * 24 * 7): string {
  const encodedHeader = encodeJson({ alg: "HS256", typ: "JWT" });
  const encodedPayload = encodeJson({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifyDashboardToken(token: string): DashboardTokenPayload | null {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) return null;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expected = sign(unsignedToken);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  try {
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as { alg?: string; typ?: string };
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as DashboardTokenPayload;
    if (!payload.sub || !payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  return authorizationHeader.slice("Bearer ".length).trim() || null;
}
