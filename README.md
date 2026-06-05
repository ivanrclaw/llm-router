# LLM Router

> Multi-tenant LLM API gateway with intelligent model routing and categorization.

Aggregate free and paid LLM APIs behind a single OpenAI-compatible endpoint.
Route requests based on task type (coding, reasoning, general), manage multiple
users and API keys, and monitor usage with built-in analytics.

## Architecture

```
llm-router/
├── apps/
│   ├── web/          # React 19 + Vite + Tailwind 4 admin dashboard
│   └── server/       # Express 5 + TypeORM + SQLite API gateway
└── packages/
    └── typescript-config/  # Shared tsconfig presets
```

## Getting Started

**Prerequisites**: Node 22+, pnpm 10+

```bash
pnpm install
pnpm dev        # Starts both web (5173) and server (3001)
```

## Features (planned)

- [x] Monorepo scaffold (Turborepo + pnpm)
- [x] Express 5 API with SQLite
- [x] React 19 dashboard with Tailwind 4 + dark mode
- [ ] OpenAI-compatible `/v1/chat/completions` endpoint
- [ ] Multi-user with API key auth
- [ ] Model categorization (coding, reasoning, vision, general)
- [ ] Provider failover and load balancing
- [ ] Usage statistics and analytics dashboard
- [ ] Docker + Fly.io deployment

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm |
| Frontend | React 19, Vite 6, TypeScript, Tailwind 4 |
| Backend | Express 5, TypeScript, TypeORM, better-sqlite3 |
| Deployment | Docker + Fly.io |
