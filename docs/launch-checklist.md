# Launch checklist

Use this checklist before declaring LLM Router production-ready.

## Automated gates

- [ ] `pnpm test:run` passes.
- [ ] `pnpm type-check` passes.
- [ ] `pnpm build` passes.
- [ ] Sprint 14 launch acceptance test passes: `pnpm --filter @llm-router/server test:run src/test/launch-acceptance.test.ts`.
- [ ] Docker image builds: `docker build -t llm-router:launch .`.
- [ ] Container serves `/api/ready`, `/api/health`, `/v1/models`, and dashboard HTML.

## API acceptance

- [ ] Register/login admin user.
- [ ] Create a team/workspace.
- [ ] Sync OpenCode Zen model catalog.
- [ ] Add at least one OpenCode Zen provider key.
- [ ] Create a platform API key with `models:read` and `chat:write` scopes.
- [ ] Verify `/v1/models` returns concrete provider models and aliases such as `free-coding`.
- [ ] Verify `/v1/chat/completions` with a concrete model.
- [ ] Verify `/v1/chat/completions` with alias `free-coding`.
- [ ] Repeat alias call with the same `X-Session-Id` and verify the same `X-LLM-Router-Resolved-Model` header.
- [ ] Set a hard team budget and verify subsequent calls are blocked with `budget_exceeded`.
- [ ] Verify usage events, daily aggregates, stats overview, stats CSV export, and model/user/key/provider breakdowns.
- [ ] Verify audit logs contain platform API key, provider key, model group, and budget mutations.

## UI acceptance

- [ ] Dashboard loads from the production server.
- [ ] English locale shows dashboard, key, provider, model, budget, stats, and docs copy.
- [ ] Spanish locale shows equivalent translated copy.
- [ ] Dark mode toggles without FOUC.
- [ ] Integration snippets use `/v1` and never show real secrets.

## Security acceptance

- [ ] Provider keys are encrypted at rest and never returned by API responses.
- [ ] Platform API keys are hashed at rest and full keys are shown once only.
- [ ] Provider errors, audit metadata, and API errors redact `lr_`, `oz_`, `sk-`, bearer tokens, hashes, and encrypted payloads.
- [ ] Prompts are not persisted by default.
- [ ] Raw session IDs are not persisted; only hashes are stored.
- [ ] CORS origins, auth rate limits, `/v1` rate limits, `JWT_SECRET`, and `ENCRYPTION_KEY` are configured through environment/secrets.

## Fly.io release

- [ ] `fly volumes list` shows `llm_router_data` mounted at `/data`.
- [ ] `fly.toml` keeps scale-to-zero enabled: `auto_stop_machines = "stop"`, `auto_start_machines = true`, `min_machines_running = 0`.
- [ ] Fly secrets are set: `JWT_SECRET`, `ENCRYPTION_KEY`, production `CORS_ORIGINS`.
- [ ] `fly deploy --remote-only` succeeds.
- [ ] `fly checks list` shows `/api/ready` passing.
- [ ] `fly logs` has no startup migration or DB errors.
- [ ] Backup command succeeds: `fly ssh console -C 'cd /app && BACKUP_DIR=/data/backups pnpm --filter @llm-router/server backup:sqlite'`.
