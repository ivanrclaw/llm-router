const SECRET_KEY_PATTERN = /(?:password|passphrase|secret|token|api[-_]?key|authorization|bearer|encrypted[-_]?key|keyHash|passwordHash|tokenHash|encryptedKey|apiKey)/i;
const INLINE_SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+/gi,
  /\blr_[A-Za-z0-9_-]{8,}\b/g,
  /\boz_[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/g,
  /\b[a-f0-9]{16,}:[a-f0-9]{16,}:[a-f0-9]{16,}\b/gi,
];

function redactString(value: string): string {
  return INLINE_SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, "[REDACTED]"), value);
}

export function redactSecrets<T>(value: T): T {
  if (typeof value === "string") return redactString(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T;
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSecrets(entry);
  }
  return output as T;
}
