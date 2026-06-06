# Key management and provider privacy

## Platform API keys

- Platform keys use the `lr_` prefix and are shown in full only once at creation time.
- The database stores only `keyPrefix` and `keyHash`; list/update responses must never expose the full key or hash.
- Scope platform keys narrowly. Use `models:read` for model discovery and `chat:write` for chat completions.
- Prefer expiration dates for automation keys and revoke unused keys immediately.
- Runtime rate limits apply at the gateway layer and per-key limits apply during `/v1/*` authentication.

## Provider API keys

- Provider keys use the upstream provider format, e.g. `oz_` for OpenCode Zen.
- The database stores provider keys encrypted at rest plus a short `keyPrefix` for display.
- Provider key create/list/update responses must never expose plaintext keys or encrypted payloads.
- Disable or revoke provider keys during incident response; failed provider 429s are cooled down before retry.

## Audit and logging

- Sensitive mutations are written to `audit_logs`.
- Client IP and user-agent are hashed before storage.
- Audit metadata is recursively redacted before persistence.
- Logs and error payloads must redact passwords, bearer tokens, platform keys, provider keys, hashes, and encrypted payloads.

## Provider privacy caveats

- Requests proxied to a provider necessarily send prompts, metadata accepted by the provider API, and the resolved concrete model name to that provider.
- Do not send regulated or confidential data to third-party providers unless your provider agreement allows it.
- Sticky-session identifiers are hashed internally; raw session IDs must not be persisted.
- Provider responses may contain provider-specific error details. The gateway normalizes internal errors and redacts secret-like values before returning server errors.
