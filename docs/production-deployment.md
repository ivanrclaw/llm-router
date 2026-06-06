# Production deployment

This app is deployed as a single container: Express serves `/api/*` and `/v1/*`, and also serves the built Vite dashboard when `SERVE_WEB_DIST=true`.

## Fly.io bootstrap

```bash
fly apps create llm-router
fly volumes create llm_router_data --region mad --size 1 --app llm-router
fly secrets set \
  JWT_SECRET="$(openssl rand -base64 48)" \
  ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  --app llm-router
fly deploy --remote-only --config fly.toml
```

The persistent SQLite database lives at `/data/llm-router.sqlite`; `fly.toml` mounts the `llm_router_data` volume at `/data` and probes `/api/ready`. The HTTP service is configured for scale-to-zero with `auto_stop_machines = "stop"`, `auto_start_machines = true`, and `min_machines_running = 0`, so Fly can stop the machine when idle and cold-start it on the next request.

## Runtime configuration

Non-secret production defaults are versioned in `fly.toml` and `.env.example`:

- `DATABASE_PATH=/data/llm-router.sqlite`
- `RUN_MIGRATIONS=true`
- `SERVE_WEB_DIST=true`
- `CORS_ORIGINS=https://llm-router.fly.dev`
- `AUTH_RATE_LIMIT_RPM=30`
- `V1_RATE_LIMIT_RPM=120`

Secrets must be configured through Fly secrets, never committed:

- `JWT_SECRET`
- `ENCRYPTION_KEY`

## Health and readiness

- `GET /api/health`: liveness check, no database dependency.
- `GET /api/ready`: readiness check; returns `200` only when the database is initialized, queryable, and migrations are not pending.

## Backup

Run a WAL checkpoint and create a restorable SQLite backup:

```bash
pnpm --filter @llm-router/server backup:sqlite
```

For Fly:

```bash
fly ssh console --app llm-router --command "cd /app && pnpm --filter @llm-router/server backup:sqlite"
```

By default backups are written next to the database. Override with:

```bash
DATABASE_PATH=/data/llm-router.sqlite BACKUP_DIR=/data/backups pnpm --filter @llm-router/server backup:sqlite
```

## Restore

1. Stop the app or scale to zero to avoid writes during restore.
2. Copy the selected backup to `/data/llm-router.sqlite`.
3. Redeploy or restart the machine.
4. Verify `GET /api/ready` returns `200` and `database.migrationsPending=false`.

Example local restore:

```bash
cp /data/backups/llm-router-YYYY-MM-DD.sqlite /data/llm-router.sqlite
```

## CI/CD

- `.github/workflows/ci.yml` runs install, type-check, tests, and build on PRs and main.
- `.github/workflows/deploy.yml` deploys to Fly.io after successful CI on main using `FLY_API_TOKEN`.
