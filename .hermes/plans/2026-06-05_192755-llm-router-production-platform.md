# LLM Router Production Platform Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan sprint-by-sprint. After every sprint, run the verification checklist, run the command gate, and audit modified files against this plan before marking the sprint complete.

**Goal:** Build `llm-router` into a production-ready, multi-tenant, OpenAI-compatible LLM gateway backed by SQLite. V1 supports OpenCode Zen only, but the architecture must support future providers without rewriting routing, accounting, budgets, or dashboard flows.

**Architecture:** Express owns authentication, authorization, provider routing, OpenAI-compatible proxying, provider-key selection, sticky session affinity, spend enforcement, usage accounting, and audit logging. React/Vite provides a professional bilingual dashboard for teams, members, platform API keys, provider keys, model catalog, model groups, budgets, usage analytics, audit logs, settings, and docs. TypeORM + better-sqlite3 is the source of truth, with migrations, production-safe indexes, backup/export, and explicit seed/sync jobs.

**Tech Stack:** pnpm + Turborepo, React 19 + Vite + TypeScript + Tailwind 4 + shadcn/ui, Express 5 + TypeScript, TypeORM + better-sqlite3, Zod, Vitest + Supertest + React Testing Library, SQLite, GitHub Actions, Docker + Fly.io.

**Implementation rule:** TDD for every backend service/route and frontend page/component that introduces behavior. Commit after every sprint. Never mark a sprint complete until type-check, tests, build, and sprint-specific API verification pass.

---

## 0. Current Context and Research Snapshot

Repository already exists:

- Local: `/home/iruizl/projects/llm-router`
- GitHub: `https://github.com/ivanrclaw/llm-router`
- Apps:
  - `apps/web`: React 19 + Vite + Tailwind 4 scaffold
  - `apps/server`: Express 5 + TypeORM + SQLite scaffold
- Existing endpoint: `GET /api/health`

OpenCode Zen research checked on **2026-06-05**:

- Docs: `https://opencode.ai/docs/zen`
- Public model metadata endpoint: `https://opencode.ai/zen/v1/models`
- OpenAI-compatible chat endpoint: `https://opencode.ai/zen/v1/chat/completions`
- Other Zen endpoint families in docs:
  - `https://opencode.ai/zen/v1/responses` for OpenAI Responses-style models
  - `https://opencode.ai/zen/v1/messages` for Anthropic-style models
  - `https://opencode.ai/zen/v1/models/<model-id>` for Google AI SDK style models
- Zen is pay-as-you-go.
- Zen supports workspaces, team roles, model access, monthly limits, and BYOK for OpenAI/Anthropic on Zen's side, but `llm-router` must implement its own team/user/API-key/budget layer independently.
- Public `/zen/v1/models` currently returned these model IDs:
  - `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-opus-4-5`, `claude-opus-4-1`
  - `claude-sonnet-4-6`, `claude-sonnet-4-5`, `claude-sonnet-4`, `claude-haiku-4-5`
  - `gemini-3.5-flash`, `gemini-3.1-pro`, `gemini-3-flash`
  - `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.3-codex-spark`, `gpt-5.3-codex`, `gpt-5.2`, `gpt-5.2-codex`, `gpt-5.1`, `gpt-5.1-codex-max`, `gpt-5.1-codex`, `gpt-5.1-codex-mini`, `gpt-5`, `gpt-5-codex`, `gpt-5-nano`
  - `grok-build-0.1`, `deepseek-v4-flash`, `glm-5.1`, `glm-5`, `minimax-m2.7`, `minimax-m2.5`, `kimi-k2.6`, `kimi-k2.5`, `qwen3.6-plus`, `qwen3.5-plus`
  - `big-pickle`, `deepseek-v4-flash-free`, `mimo-v2.5-free`, `qwen3.6-plus-free`, `minimax-m3-free`, `nemotron-3-ultra-free`, `nemotron-3-super-free`

### 0.1 OpenCode Zen free model handling

The docs pricing table explicitly lists these free models:

- `big-pickle` — input free, output free, cached read free, cached write unavailable
- `deepseek-v4-flash-free` — input/output/cache read/cache write free
- `mimo-v2.5-free` — input/output/cache read/cache write free
- `nemotron-3-ultra-free` — input/output/cache read/cache write free

The live model endpoint also currently lists additional `*-free` IDs:

- `qwen3.6-plus-free`
- `minimax-m3-free`
- `nemotron-3-super-free`

Seed these as `isFree=true` only if one of these is true:

1. pricing docs/parser confirms zero pricing, or
2. the model ID ends in `-free` and no contradictory pricing exists.

Store a `pricingConfidence` / `sourceKind` value so the UI and stats can distinguish:

- `docs_pricing_verified`
- `live_model_id_inferred`
- `manual_admin_override`
- `unknown`

For cost/savings, free models use zero cost only when `isFree=true`. If a free-looking model lacks verified pricing, display a warning badge such as “free inferred from model ID; refresh pricing”.

### 0.2 Current OpenCode Zen pricing seed

Seed the following prices per 1M tokens, source `https://opencode.ai/docs/zen`, source date `2026-06-05`.

Verified free / chat-compatible:

- `big-pickle`: input $0, output $0, cached read $0, cached write unavailable
- `deepseek-v4-flash-free`: input $0, output $0, cached read $0, cached write $0
- `mimo-v2.5-free`: input $0, output $0, cached read $0, cached write $0
- `nemotron-3-ultra-free`: input $0, output $0, cached read $0, cached write $0

Additional free inferred from live model IDs until pricing parser confirms:

- `qwen3.6-plus-free`: input $0, output $0, cached read $0, cached write unknown, confidence `live_model_id_inferred`
- `minimax-m3-free`: input $0, output $0, cached read $0, cached write unknown, confidence `live_model_id_inferred`
- `nemotron-3-super-free`: input $0, output $0, cached read $0, cached write unknown, confidence `live_model_id_inferred`

Paid chat-compatible / OpenAI-compatible models:

- `minimax-m2.7`: input $0.30, output $1.20, cached read $0.06, cached write $0.375
- `minimax-m2.5`: input $0.30, output $1.20, cached read $0.06, cached write $0.375
- `glm-5.1`: input $1.40, output $4.40, cached read $0.26, cached write unavailable
- `glm-5`: input $1.00, output $3.20, cached read $0.20, cached write unavailable, deprecated May 14 2026
- `kimi-k2.5`: input $0.60, output $3.00, cached read $0.10, cached write unavailable
- `kimi-k2.6`: input $0.95, output $4.00, cached read $0.16, cached write unavailable
- `qwen3.7-max`: input $2.50, output $7.50, cached read $0.50, cached write $3.125
- `qwen3.7-plus`: input $0.40, output $1.60, cached read $0.04, cached write $0.50
- `qwen3.6-plus`: input $0.50, output $3.00, cached read $0.05, cached write $0.625
- `qwen3.5-plus`: input $0.20, output $1.20, cached read $0.02, cached write $0.25
- `deepseek-v4-flash`: input $0.14, output $0.28, cached read $0.03, cached write unavailable
- `grok-build-0.1`: input $1.00, output $2.00, cached read $0.20, cached write unavailable

Paid non-chat endpoint families should still be stored in the catalog, but must not be returned as available for `/v1/chat/completions` unless the adapter implements a safe translation layer:

- Responses endpoint: GPT family
- Messages endpoint: Claude and some Qwen models
- Google endpoint: Gemini family

V1 implementation should expose `/v1/chat/completions` only for chat-compatible models and model groups whose candidates are endpoint-compatible.

---

## 1. Product Scope

### 1.1 Core capabilities

- Multi-team SaaS-style platform.
- Users can belong to multiple teams.
- Team roles:
  - `owner`: full team, billing/budget, provider keys, members, destructive actions
  - `admin`: provider keys, models, model groups, budgets, members except owner transfer
  - `member`: own platform API keys, usage, limited team settings
  - `viewer`: read-only dashboard/stats
- Each user can create one or more platform API keys to access `llm-router`.
- Each team can configure multiple provider API keys per provider.
- V1 provider list contains one provider: `opencode-zen`.
- Provider keys can be enabled/disabled, named, prioritized, rate-limited, quota-limited, budget-limited, and tested.
- Admins can define model groups such as:
  - `free-coding`: only free OpenCode Zen coding/chat-compatible models
  - `coding`: strong coding-agent models, free first, paid fallback if allowed
  - `cheap`: cheapest acceptable models
  - `reasoning`: reasoning-capable models with strict budget constraints
  - `fallback`: stable fallback pool
- Clients call OpenAI-compatible endpoints using either a concrete Zen model ID or a model group alias.
- Router resolves aliases to concrete models using endpoint compatibility, policy, spend limits, availability, provider-key status, and sticky session affinity.
- Sticky session routing attempts to reuse the same concrete model in the same logical session to improve provider cache hit rate.
- Usage tracking captures requests, latency, tokens, cached tokens, model, provider key, team, user, platform API key, status, errors, cost, and estimated savings.
- Spend controls at team, team member, platform API key, provider key, model, and model group scopes.
- Complete statistics dashboard with charts, filters, CSV export, and drilldowns.
- English and Spanish i18n for every visible frontend string and relevant backend-facing labels.
- SQLite persistence with migrations, indexes, backup/export, and startup migration runner.
- Production deployment-ready: Docker, Fly.io, GitHub Actions, health/ready checks, security headers, CORS, rate limits, and secrets documentation.

### 1.2 Explicit non-goals for V1

- No marketplace/billing for external customers.
- No prompt/content logging by default.
- No provider other than OpenCode Zen implemented, though abstractions must be provider-ready.
- No automatic scraping of private pricing pages. Use public docs, live model metadata, and admin overrides.
- No routing to non-chat Zen endpoint families through `/v1/chat/completions` unless a tested translation adapter is implemented.

---

## 2. Provider Architecture

### 2.1 Provider registry

Create a provider registry with a single V1 provider:

```ts
type ProviderSlug = 'opencode-zen';

type ProviderEndpointType =
  | 'openai_chat_completions'
  | 'openai_responses'
  | 'anthropic_messages'
  | 'google_model_endpoint';

interface ProviderAdapter {
  slug: ProviderSlug;
  displayName: string;
  listModels(ctx: ProviderListModelsContext): Promise<ProviderModelSnapshot[]>;
  validateKey(ctx: ProviderKeyValidationContext): Promise<ProviderKeyValidationResult>;
  chatCompletions(request: NormalizedChatCompletionRequest, ctx: ProviderCallContext): Promise<ProviderResponse>;
  streamChatCompletions(request: NormalizedChatCompletionRequest, ctx: ProviderCallContext): Promise<ReadableStream | NodeJS.ReadableStream>;
  estimateCost(usage: TokenUsage, pricing: ModelPricingSnapshot): MoneyCents;
}
```

Rules:

- Provider-specific code must stay under `apps/server/src/providers/`.
- Router core must never know OpenCode-specific URLs beyond provider registry metadata.
- Provider adapters return normalized results and normalized errors.
- Provider adapter must redact API keys and request bodies from logs.
- Provider model catalog stores endpoint type and capabilities.

### 2.2 OpenCode Zen adapter

OpenCode Zen config:

- Provider slug: `opencode-zen`
- Base URL: `https://opencode.ai/zen/v1`
- Chat endpoint: `/chat/completions`
- Models endpoint: `/models`
- Auth: `Authorization: Bearer <provider-api-key>`
- Supports streaming for chat-compatible models through SSE passthrough if upstream returns SSE.

Adapter responsibilities:

- Validate provider key with `/models` or a safe minimal metadata request.
- Fetch live model list from `/models`.
- Merge live models with seeded endpoint/pricing metadata.
- Classify endpoint family from docs/seed data.
- Only allow `openai_chat_completions` models in `/v1/chat/completions` unless translation exists.
- Normalize provider 401/403/429/5xx errors.
- Mark provider keys with `lastErrorAt`, `lastErrorCode`, and optional cooldown after 429/5xx.
- Preserve OpenAI-compatible response shape for non-streaming.
- Preserve SSE chunks for streaming while injecting router headers before stream starts.

---

## 3. Routing Design

### 3.1 Request flow

1. Client calls `POST /v1/chat/completions` with `Authorization: Bearer <lr_...>`.
2. Server authenticates platform API key.
3. Server identifies user, team, scopes, and API key status.
4. Server validates team/user/API-key/provider/model budgets before routing.
5. Server validates request body with Zod.
6. Server parses requested `model`:
   - If concrete enabled model: route directly if endpoint-compatible.
   - If model group alias: resolve to a concrete endpoint-compatible model.
7. Server derives session key:
   - Prefer `X-Session-Id` header.
   - Else prefer OpenAI-compatible `user` field if present.
   - Else prefer `metadata.session_id` if present.
   - Else compute stable hash from first system message + first user message + platform API key id.
8. Server checks `SessionAffinity` for `(teamId, platformApiKeyId, requestedModel, sessionKeyHash)`.
9. If a valid sticky mapping exists and model/provider remains enabled and within budget, reuse it.
10. Otherwise choose model candidate according to model group policy.
11. Select provider API key according to team/provider/key priority, quota, cooldown, health, budget, and rate limits.
12. Forward to OpenCode Zen.
13. For non-streaming, collect response and usage.
14. For streaming, stream SSE without buffering; collect usage if final provider chunk includes it, otherwise store estimated tokens/cost with `usageSource='estimated'`.
15. Capture latency, status, provider key used, concrete model, and error details.
16. Compute actual or estimated cost and savings.
17. Store `UsageEvent` and update `UsageDailyAggregate` in a transaction.
18. Return OpenAI-compatible response plus router headers:
    - `X-LLM-Router-Request-Id`
    - `X-LLM-Router-Provider: opencode-zen`
    - `X-LLM-Router-Model: <concrete-model>`
    - `X-LLM-Router-Model-Group: <alias>` when applicable
    - `X-LLM-Router-Cost-USD: <estimated-or-actual-cost>`
    - `X-LLM-Router-Usage-Source: provider|estimated|unavailable`

### 3.2 Sticky session routing

Objective: improve provider cache hit rate by keeping the same concrete model during a session.

Rules:

- TTL default: 24 hours, configurable per team/model group.
- Affinity key includes requested model alias/group; a `coding` session and a `reasoning` session must not collide.
- Affinity stores concrete model, provider, and last provider key used, but provider key can rotate if needed.
- Affinity survives provider-key rotation but not disabled/deprecated/disallowed models.
- If selected concrete model fails twice consecutively within a session, mark affinity degraded and allow fallback.
- Sticky affinity must be bypassed when budget policy, model group constraints, endpoint compatibility, or admin model access rules disallow the model.
- Store session key as a hash only; never store raw user/session prompt content.

### 3.3 Model group resolution policy

Each group has ordered candidates with constraints:

- `priority`: lower number first
- `weight`: weighted selection inside same priority
- `endpointTypes`: allowed endpoint families
- `maxCostUsdPer1MInput`
- `maxCostUsdPer1MOutput`
- `allowPaidModels`
- `freeOnly`
- `requireCacheWriteSupport`
- `tags`: `coding`, `reasoning`, `fast`, `cheap`, `free`, `long-context`, `multimodal`, `agentic`, `fallback`
- `fallbackEnabled`
- `fallbackOnProviderError`
- `fallbackOnBudgetExceeded`
- `baselineModelForSavings`
- `stickySessionTtlSeconds`

Default groups:

- `free-coding`:
  - `big-pickle`
  - `mimo-v2.5-free`
  - `deepseek-v4-flash-free`
  - `nemotron-3-ultra-free`
  - optionally inferred-free models when enabled by admin: `minimax-m3-free`, `qwen3.6-plus-free`, `nemotron-3-super-free`
- `coding`:
  - free models first
  - `minimax-m2.7`
  - `kimi-k2.6`
  - `qwen3.7-plus` only if endpoint translation/compatibility is supported; otherwise exclude from chat groups
  - `grok-build-0.1`
- `cheap`:
  - free models first
  - `deepseek-v4-flash`
  - `qwen3.5-plus` only if endpoint-compatible or translation-supported
  - `minimax-m2.5`
- `reasoning`:
  - `grok-build-0.1`
  - `kimi-k2.6`
  - `glm-5.1`
  - free fallback only if paid disallowed
- `chat-default`:
  - free models first
  - `deepseek-v4-flash`
  - `minimax-m2.5`

Important: if a model is stored as non-chat endpoint type, a chat-completions group must skip it unless adapter translation is explicitly implemented and tested.

---

## 4. Database Design

Use TypeORM migrations, not `synchronize: true`, outside local development.

### 4.1 Entities under `apps/server/src/entities/`

Create these entities:

- `User.ts`
  - `id`, `email`, `name`, `passwordHash`, `locale`, `timezone`, `isActive`, `createdAt`, `updatedAt`, `lastLoginAt`
- `Team.ts`
  - `id`, `name`, `slug`, `ownerId`, `defaultMonthlyBudgetUsdCents`, `defaultDailyBudgetUsdCents`, `createdAt`, `updatedAt`
- `TeamMember.ts`
  - `id`, `teamId`, `userId`, `role`, `monthlyBudgetUsdCents`, `dailyBudgetUsdCents`, `isActive`, `createdAt`, `updatedAt`
- `Invitation.ts`
  - `id`, `teamId`, `email`, `role`, `tokenHash`, `expiresAt`, `acceptedAt`, `createdByUserId`, `createdAt`
- `PlatformApiKey.ts`
  - `id`, `teamId`, `userId`, `name`, `keyPrefix`, `keyHash`, `scopesJson`, `monthlyBudgetUsdCents`, `dailyBudgetUsdCents`, `rateLimitRpm`, `lastUsedAt`, `expiresAt`, `revokedAt`, `createdAt`
- `Provider.ts`
  - `id`, `slug`, `displayName`, `baseUrl`, `isEnabled`, `createdAt`, `updatedAt`
- `ProviderApiKey.ts`
  - `id`, `teamId`, `providerId`, `name`, `keyPrefix`, `encryptedKey`, `priority`, `monthlyBudgetUsdCents`, `dailyBudgetUsdCents`, `rpmLimit`, `isEnabled`, `healthStatus`, `lastValidatedAt`, `lastUsedAt`, `lastErrorAt`, `lastErrorCode`, `cooldownUntil`, `createdAt`, `updatedAt`
- `ProviderModel.ts`
  - `id`, `providerId`, `externalModelId`, `displayName`, `endpointType`, `contextWindowTokens`, `tagsJson`, `capabilitiesJson`, `isFree`, `isEnabled`, `pricingConfidence`, `metadataJson`, `deprecatedAt`, `createdAt`, `updatedAt`
- `ModelPricing.ts`
  - `id`, `providerModelId`, `currency`, `inputUsdPer1M`, `outputUsdPer1M`, `cachedReadUsdPer1M`, `cachedWriteUsdPer1M`, `isFree`, `pricingConfidence`, `sourceUrl`, `sourceUpdatedAt`, `effectiveFrom`, `effectiveTo`, `createdAt`
- `ModelGroup.ts`
  - `id`, `teamId` nullable for global defaults, `alias`, `displayName`, `description`, `policyJson`, `stickySessionTtlSeconds`, `isEnabled`, `createdAt`, `updatedAt`
- `ModelGroupCandidate.ts`
  - `id`, `modelGroupId`, `providerModelId`, `priority`, `weight`, `isEnabled`, `constraintsJson`, `createdAt`, `updatedAt`
- `SessionAffinity.ts`
  - `id`, `teamId`, `platformApiKeyId`, `requestedModel`, `sessionKeyHash`, `providerId`, `providerModelId`, `lastProviderApiKeyId`, `expiresAt`, `hitCount`, `failureCount`, `isDegraded`, `firstSeenAt`, `lastSeenAt`
- `UsageEvent.ts`
  - `id`, `requestId`, `teamId`, `userId`, `platformApiKeyId`, `providerId`, `providerApiKeyId`, `providerModelId`, `requestedModel`, `resolvedModel`, `sessionKeyHash`, `status`, `errorCode`, `httpStatus`, `promptTokens`, `completionTokens`, `cachedReadTokens`, `cachedWriteTokens`, `totalTokens`, `latencyMs`, `costUsdCents`, `savedUsdCents`, `baselineModelId`, `usageSource`, `isStreaming`, `createdAt`
- `UsageDailyAggregate.ts`
  - `id`, `date`, `teamId`, `userId` nullable, `platformApiKeyId` nullable, `modelId` nullable, `providerApiKeyId` nullable, `requestCount`, `successCount`, `errorCount`, `promptTokens`, `completionTokens`, `cachedReadTokens`, `cachedWriteTokens`, `costUsdCents`, `savedUsdCents`, `avgLatencyMs`, `p50LatencyMs`, `p95LatencyMs`
- `BudgetPolicy.ts`
  - `id`, `scopeType`, `scopeId`, `monthlyBudgetUsdCents`, `dailyBudgetUsdCents`, `hardLimit`, `alertThresholdsJson`, `createdAt`, `updatedAt`
- `BudgetLedger.ts`
  - `id`, `scopeType`, `scopeId`, `periodType`, `periodKey`, `spentUsdCents`, `reservedUsdCents`, `updatedAt`
- `AuditLog.ts`
  - `id`, `teamId`, `actorUserId`, `action`, `resourceType`, `resourceId`, `ipHash`, `userAgentHash`, `metadataJson`, `createdAt`
- `SystemSetting.ts`
  - `key`, `valueJson`, `updatedAt`

### 4.2 Required indexes

Add indexes for:

- `User.email` unique
- `Team.slug` unique
- `TeamMember.teamId/userId` unique
- `PlatformApiKey.keyHash` unique
- `PlatformApiKey.teamId/userId/revokedAt`
- `Provider.slug` unique
- `ProviderApiKey.teamId/providerId/isEnabled/priority`
- `ProviderApiKey.cooldownUntil`
- `ProviderModel.providerId/externalModelId` unique
- `ProviderModel.providerId/endpointType/isEnabled`
- `ModelPricing.providerModelId/effectiveFrom/effectiveTo`
- `ModelGroup.teamId/alias` unique
- `ModelGroupCandidate.modelGroupId/priority/weight`
- `SessionAffinity.teamId/platformApiKeyId/requestedModel/sessionKeyHash` unique
- `SessionAffinity.expiresAt`
- `UsageEvent.teamId/createdAt`
- `UsageEvent.userId/createdAt`
- `UsageEvent.platformApiKeyId/createdAt`
- `UsageEvent.providerModelId/createdAt`
- `UsageEvent.providerApiKeyId/createdAt`
- `UsageDailyAggregate.date/teamId/userId/modelId/platformApiKeyId/providerApiKeyId`
- `BudgetLedger.scopeType/scopeId/periodType/periodKey` unique
- `AuditLog.teamId/createdAt`

---

## 5. Backend File Plan

Create/modify server files:

- `apps/server/src/config/env.ts`
- `apps/server/src/config/constants.ts`
- `apps/server/src/config/data-source.ts` or existing `data-source.ts`
- `apps/server/src/app.ts`
- `apps/server/src/index.ts`
- `apps/server/src/lib/crypto.ts`
- `apps/server/src/lib/hash.ts`
- `apps/server/src/lib/money.ts`
- `apps/server/src/lib/errors.ts`
- `apps/server/src/lib/openai-error.ts`
- `apps/server/src/lib/request-id.ts`
- `apps/server/src/lib/redact.ts`
- `apps/server/src/middleware/dashboard-auth.ts`
- `apps/server/src/middleware/api-key-auth.ts`
- `apps/server/src/middleware/require-role.ts`
- `apps/server/src/middleware/error-handler.ts`
- `apps/server/src/middleware/audit-context.ts`
- `apps/server/src/middleware/rate-limit.ts`
- `apps/server/src/services/auth.service.ts`
- `apps/server/src/services/team.service.ts`
- `apps/server/src/services/invitation.service.ts`
- `apps/server/src/services/api-key.service.ts`
- `apps/server/src/services/provider-key.service.ts`
- `apps/server/src/services/model-catalog.service.ts`
- `apps/server/src/services/model-group.service.ts`
- `apps/server/src/services/router.service.ts`
- `apps/server/src/services/session-affinity.service.ts`
- `apps/server/src/services/budget.service.ts`
- `apps/server/src/services/usage.service.ts`
- `apps/server/src/services/stats.service.ts`
- `apps/server/src/services/audit-log.service.ts`
- `apps/server/src/providers/types.ts`
- `apps/server/src/providers/opencode-zen.adapter.ts`
- `apps/server/src/providers/registry.ts`
- `apps/server/src/routes/auth.routes.ts`
- `apps/server/src/routes/team.routes.ts`
- `apps/server/src/routes/api-key.routes.ts`
- `apps/server/src/routes/provider.routes.ts`
- `apps/server/src/routes/model.routes.ts`
- `apps/server/src/routes/model-group.routes.ts`
- `apps/server/src/routes/stats.routes.ts`
- `apps/server/src/routes/audit.routes.ts`
- `apps/server/src/routes/settings.routes.ts`
- `apps/server/src/routes/openai-compatible.routes.ts`
- `apps/server/src/seeds/opencode-zen-models.ts`
- `apps/server/src/seeds/default-model-groups.ts`
- `apps/server/src/scripts/seed.ts`
- `apps/server/src/scripts/sync-opencode-models.ts`
- `apps/server/src/scripts/backup-sqlite.ts`
- `apps/server/src/scripts/run-migrations.ts`

---

## 6. API Contract

### 6.1 Dashboard/admin API

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

Teams/members:

- `GET /api/teams`
- `POST /api/teams`
- `GET /api/teams/:teamId`
- `PATCH /api/teams/:teamId`
- `GET /api/teams/:teamId/members`
- `POST /api/teams/:teamId/invitations`
- `PATCH /api/teams/:teamId/members/:memberId`
- `DELETE /api/teams/:teamId/members/:memberId`

Platform API keys:

- `GET /api/teams/:teamId/api-keys`
- `POST /api/teams/:teamId/api-keys`
- `PATCH /api/teams/:teamId/api-keys/:keyId`
- `DELETE /api/teams/:teamId/api-keys/:keyId`

Providers/provider keys:

- `GET /api/teams/:teamId/providers`
- `GET /api/teams/:teamId/providers/:providerSlug/keys`
- `POST /api/teams/:teamId/providers/:providerSlug/keys`
- `POST /api/teams/:teamId/provider-keys/:keyId/test`
- `PATCH /api/teams/:teamId/provider-keys/:keyId`
- `DELETE /api/teams/:teamId/provider-keys/:keyId`

Models/model groups:

- `GET /api/teams/:teamId/models`
- `POST /api/teams/:teamId/models/sync`
- `PATCH /api/teams/:teamId/models/:modelId`
- `GET /api/teams/:teamId/model-groups`
- `POST /api/teams/:teamId/model-groups`
- `PATCH /api/teams/:teamId/model-groups/:groupId`
- `DELETE /api/teams/:teamId/model-groups/:groupId`

Budgets:

- `GET /api/teams/:teamId/budgets`
- `PATCH /api/teams/:teamId/budgets/:scopeType/:scopeId`
- `GET /api/teams/:teamId/budgets/usage`

Stats:

- `GET /api/teams/:teamId/stats/overview`
- `GET /api/teams/:teamId/stats/usage-timeseries`
- `GET /api/teams/:teamId/stats/models`
- `GET /api/teams/:teamId/stats/users`
- `GET /api/teams/:teamId/stats/api-keys`
- `GET /api/teams/:teamId/stats/provider-keys`
- `GET /api/teams/:teamId/stats/errors`
- `GET /api/teams/:teamId/stats/latency`
- `GET /api/teams/:teamId/stats/export.csv`

Audit/settings:

- `GET /api/teams/:teamId/audit-log`
- `GET /api/teams/:teamId/settings`
- `PATCH /api/teams/:teamId/settings`

Health:

- `GET /api/health`
- `GET /api/ready`

### 6.2 OpenAI-compatible API

V1 required:

- `GET /v1/models`
- `POST /v1/chat/completions`

V1 optional only if time permits and tests prove compatibility:

- `POST /v1/responses`
- `POST /v1/messages`

`GET /v1/models` must return both:

- concrete endpoint-compatible models
- model group aliases, marked with metadata showing `llm_router_type='model_group'`

---

## 7. Frontend File Plan

Create professional dashboard under `apps/web/src/`:

- `lib/api.ts`
- `lib/auth.ts`
- `lib/i18n.ts`
- `lib/format.ts`
- `lib/routes.ts`
- `lib/query.ts`
- `hooks/useAuth.ts`
- `hooks/useTeam.ts`
- `hooks/useStats.ts`
- `hooks/useMutationToast.ts`
- `components/layout/AppShell.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/Header.tsx`
- `components/layout/ProtectedRoute.tsx`
- `components/ui/*` via shadcn/ui
- `components/charts/UsageChart.tsx`
- `components/charts/CostChart.tsx`
- `components/charts/ModelDistributionChart.tsx`
- `components/charts/LatencyChart.tsx`
- `components/stats/StatCard.tsx`
- `components/stats/SpendProgress.tsx`
- `components/api-keys/ApiKeyCreateDialog.tsx`
- `components/api-keys/ApiKeyList.tsx`
- `components/providers/ProviderKeyCreateDialog.tsx`
- `components/providers/ProviderKeyList.tsx`
- `components/models/ModelCatalogTable.tsx`
- `components/models/ModelGroupEditor.tsx`
- `components/budgets/BudgetEditor.tsx`
- `components/audit/AuditLogTable.tsx`
- `pages/LoginPage.tsx`
- `pages/RegisterPage.tsx`
- `pages/DashboardPage.tsx`
- `pages/ApiKeysPage.tsx`
- `pages/ProviderKeysPage.tsx`
- `pages/ModelsPage.tsx`
- `pages/ModelGroupsPage.tsx`
- `pages/StatsPage.tsx`
- `pages/BudgetsPage.tsx`
- `pages/TeamMembersPage.tsx`
- `pages/SettingsPage.tsx`
- `pages/AuditLogPage.tsx`
- `pages/DocsPage.tsx`
- `i18n/en/common.json`
- `i18n/es/common.json`

### 7.1 Required UI sections

Overview dashboard:

- requests today/month
- success/error rate
- total tokens
- cached tokens
- estimated cost
- estimated savings from free models/cache
- average, p50, and p95 latency
- active users/API keys/provider keys
- recent errors
- budget progress bars

API keys:

- create/revoke platform API keys
- show full key only once
- copy-to-clipboard
- scopes
- per-key daily/monthly budget
- expiry date
- rate limit
- last used

Provider keys:

- list supported providers; V1 only `OpenCode Zen`
- add multiple OpenCode Zen keys
- priority, quota, rpm, enable/disable
- masked display
- health check/test button
- last used/error/cooldown status

Models:

- list OpenCode Zen model catalog
- endpoint family badge
- free/paid/unknown pricing badge
- pricing columns
- source/date/confidence
- tags and capabilities
- enabled/disabled toggle
- deprecated warning

Model groups:

- create/edit aliases (`coding`, `free-coding`, etc.)
- ordered candidates
- weights
- free-only toggle
- endpoint compatibility warnings
- max input/output cost constraints
- sticky session TTL
- baseline model for savings

Statistics:

- date range filter
- group by user/model/provider key/API key/model group
- cost and savings charts
- cache read/write stats
- latency percentiles
- error breakdown
- CSV export

Budgets:

- team budgets
- member budgets
- platform API key budgets
- provider key budgets
- model/model-group budgets
- hard/soft threshold configuration

Team management:

- members
- roles
- invitations
- budgets

Settings:

- locale EN/ES
- default team
- budget defaults
- CORS/docs display configuration

Audit log:

- key creation/revocation
- provider key changes
- budget changes
- model/model-group changes
- member/role changes

Docs page:

- curl example
- OpenAI SDK example
- OpenCode/agent usage example
- model group examples
- session affinity example using `X-Session-Id`
- explanation of spending headers and stats

---

## 8. Sprint Plan

## Sprint 0 — Test infrastructure and project hygiene

**Objective:** Add the test harness before feature work.

**Files:**

- Modify: root `package.json`
- Modify: `apps/server/package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/vitest.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/server/src/test/test-db.ts`
- Create: `apps/server/src/test/app-factory.ts`
- Create: `apps/server/src/test/fixtures/`

**Tasks:**

1. Add server dependencies: `vitest`, `supertest`, `@types/supertest`.
2. Add web dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
3. Refactor Express into an app factory so tests can import the app without listening on a port.
4. Add root scripts: `type-check`, `test`, `test:run`, `build`, `lint` if available.
5. Add smoke tests for `/api/health`.
6. Add test DB helper with isolated temp SQLite files.
7. Add command gate docs to `docs/verification.md`.

**Verification:**

- `pnpm type-check` passes.
- `pnpm test:run` passes.
- `pnpm build` passes.
- `curl -s http://localhost:3001/api/health` works when server runs.

---

## Sprint 1 — Database migrations and core entities

**Objective:** Replace dev-only DB setup with production-safe entities, migrations, indexes, and seeds.

**Files:**

- Modify: `apps/server/src/data-source.ts`
- Create all entities listed in section 4.1.
- Create initial migration under `apps/server/src/migrations/`.
- Create seed files under `apps/server/src/seeds/`.
- Create migration/seed scripts.

**Tasks:**

1. Disable `synchronize` outside test/dev and use migrations.
2. Implement all entities with TypeORM decorators.
3. Add indexes from section 4.2.
4. Add migration run/revert scripts.
5. Seed Provider `opencode-zen`.
6. Seed known OpenCode Zen models, endpoint types, capabilities, pricing, and confidence values from section 0.
7. Seed default model groups.
8. Add idempotent seed runner.

**Verification:**

- Test: migration creates all tables in temp SQLite DB.
- Test: indexes/unique constraints work.
- Test: seed inserts provider, known models, pricing, and model groups idempotently.
- Test: free models have zero cost and correct confidence.
- `pnpm --filter @llm-router/server test:run` passes.

---

## Sprint 2 — Auth, users, teams, roles, invitations

**Objective:** Build secure dashboard auth and team membership.

**Files:**

- Create `auth.service.ts`, `team.service.ts`, `invitation.service.ts`.
- Create dashboard auth middleware and role middleware.
- Create auth/team routes.
- Create web login/register/team switcher pages.
- Create i18n dictionaries.

**Tasks:**

1. Implement password hashing with Argon2 or bcrypt.
2. Implement JWT or secure HTTP-only cookie auth for dashboard API.
3. Register creates user + default team + owner membership.
4. Login returns auth token/cookie and updates `lastLoginAt`.
5. Implement `GET /api/auth/me`.
6. Implement team list/create/update.
7. Implement members list/role update/remove.
8. Implement invitations with hashed tokens.
9. Add role-based access checks.
10. Build Login/Register/Team switcher UI.
11. Add English/Spanish translations for all visible strings.

**Verification:**

- Tests for register/login/logout/me.
- Tests for team creation and ownership.
- Tests for role checks and team isolation.
- Web tests for LoginPage/RegisterPage rendering in EN/ES.

---

## Sprint 3 — Platform API keys

**Objective:** Let users create/revoke API keys for OpenAI-compatible access.

**Files:**

- Create `api-key.service.ts`.
- Create `api-key.routes.ts`.
- Create `middleware/api-key-auth.ts`.
- Create `ApiKeysPage.tsx`, dialogs, list components.

**Tasks:**

1. Generate platform keys with prefix `lr_` and random secret.
2. Store only `keyHash` and `keyPrefix`.
3. Show full key only once at creation.
4. Implement revoke/update/expiry.
5. Implement scopes.
6. Implement optional per-key daily/monthly budgets.
7. Implement optional per-key rate limit.
8. Authenticate `/v1/*` using platform API key.
9. Add API Keys UI with copy-on-create, revoke, budget and scope display.
10. Audit-log all key changes.

**Verification:**

- Test: generated key authenticates `/v1/models`.
- Test: revoked/expired key fails.
- Test: dashboard never returns full key after creation.
- Test: team isolation for keys.
- UI test: create dialog shows key once.

---

## Sprint 4 — OpenCode Zen provider key pool

**Objective:** Store multiple OpenCode Zen keys per team and select usable keys.

**Files:**

- Create `provider-key.service.ts`.
- Create `provider.routes.ts`.
- Create `providers/opencode-zen.adapter.ts`.
- Create `ProviderKeysPage.tsx` and components.

**Tasks:**

1. Add encryption-at-rest for provider API keys using `ENCRYPTION_KEY`.
2. Create/add/list/update/revoke provider keys.
3. Store prefix only for display.
4. Implement provider key validation against `/zen/v1/models`.
5. Implement key selection by priority, enabled status, quota, budget, rpm limit, health, and cooldown.
6. Implement last used/error tracking.
7. Add Provider Keys UI.
8. Audit-log all provider key changes.

**Verification:**

- Test: encrypted key is not stored plaintext.
- Test: disabled/revoked/cooldown key is never selected.
- Test: priority ordering works.
- Test: provider 401/403/429 updates key status correctly.
- UI test: masked key display and test action.

---

## Sprint 5 — Model catalog, pricing, and sync

**Objective:** Persist OpenCode Zen model catalog and auditable pricing.

**Files:**

- Create `model-catalog.service.ts`.
- Create `sync-opencode-models.ts`.
- Create `model.routes.ts`.
- Create `ModelsPage.tsx` and `ModelCatalogTable.tsx`.

**Tasks:**

1. Seed known OpenCode Zen models and pricing.
2. Fetch live metadata from `https://opencode.ai/zen/v1/models`.
3. Merge live list with seeded pricing and endpoint metadata.
4. Mark unknown models with `pricingConfidence='unknown'` unless inferable.
5. Preserve manual/admin pricing if remote metadata lacks pricing.
6. Store `sourceUrl` and `sourceUpdatedAt`.
7. Parse docs pricing if feasible; otherwise document manual seed source.
8. Add model enable/disable.
9. Add UI badges for free/paid/unknown/inferred and current prices.
10. Add filters: provider, endpoint family, free, paid, pricing unknown, coding, enabled, deprecated.

**Verification:**

- Test: known free models are marked `isFree=true` and cost zero.
- Test: `*-free` live models become inferred-free if no contradictory pricing exists.
- Test: paid prices calculate correctly per 1M tokens.
- Test: sync is idempotent and does not wipe manual pricing.
- Test: chat endpoint groups skip non-chat endpoint models.

---

## Sprint 6 — Model groups and routing policy

**Objective:** Add aliases like `coding` that resolve to concrete OpenCode models.

**Files:**

- Create `model-group.service.ts`.
- Create `router.service.ts`.
- Create `model-group.routes.ts`.
- Create `ModelGroupsPage.tsx` and `ModelGroupEditor.tsx`.

**Tasks:**

1. Implement CRUD for model groups.
2. Implement candidate ordering and weights.
3. Implement constraints: endpoint type, free-only, max cost, tags, disabled models, deprecated models.
4. Implement default groups from section 3.3.
5. Implement `GET /v1/models` returning concrete chat-compatible models and aliases.
6. Build Model Group editor UI.
7. Add warnings when group candidates are incompatible with `/v1/chat/completions`.

**Verification:**

- Test: `coding` resolves only enabled endpoint-compatible candidate models.
- Test: `free-coding` never chooses paid models.
- Test: disabled/deprecated model is skipped.
- Test: `/v1/models` includes aliases and concrete models.
- UI test: group editor validates incompatible candidates.

---

## Sprint 7 — Sticky session affinity

**Objective:** Keep the same concrete model per logical session to improve cache hit rate.

**Files:**

- Create `session-affinity.service.ts`.
- Modify `router.service.ts`.
- Add tests.

**Tasks:**

1. Implement session key derivation from header/user/metadata/fallback hash.
2. Store only hashed session keys.
3. Store affinity after first route resolution.
4. Reuse valid affinity on subsequent requests.
5. Expire by TTL.
6. Break affinity if model disabled, endpoint incompatible, deprecated, or budget disallows it.
7. Count hits/failures.
8. Mark degraded after repeated failures and allow fallback.

**Verification:**

- Test: same `X-Session-Id` + `coding` resolves same model.
- Test: different session can resolve different model.
- Test: expired session creates new affinity.
- Test: disabled model forces re-resolution.
- Test: no raw session or prompt content is stored.

---

## Sprint 8 — OpenAI-compatible chat completions proxy

**Objective:** Implement `POST /v1/chat/completions` against OpenCode Zen.

**Files:**

- Create `openai-compatible.routes.ts`.
- Modify `opencode-zen.adapter.ts`.
- Modify `router.service.ts`.
- Create fixtures under `apps/server/src/test/fixtures/`.

**Tasks:**

1. Validate OpenAI-compatible request with Zod.
2. Resolve requested model/group to concrete model.
3. Enforce endpoint compatibility.
4. Select provider key.
5. Forward non-streaming requests to OpenCode Zen.
6. Forward streaming requests as SSE without buffering entire response.
7. Preserve OpenAI-compatible response shape.
8. Attach router metadata headers.
9. Handle provider errors with normalized OpenAI-compatible errors.
10. On provider 429/5xx, mark provider key error and try fallback if policy allows.
11. Ensure secrets/prompts are not logged.

**Verification:**

- Mocked provider test: non-streaming request succeeds.
- Mocked provider test: streaming request returns SSE.
- Test: invalid model returns OpenAI-compatible 400/404 error.
- Test: non-chat endpoint model is rejected for `/v1/chat/completions`.
- Test: provider 429 marks key as errored and tries fallback if configured.

---

## Sprint 9 — Usage accounting, cost, savings, budgets

**Objective:** Track every request and enforce spend controls.

**Files:**

- Create `usage.service.ts`.
- Create `budget.service.ts`.
- Create budget routes and UI components.
- Modify proxy route and adapter.

**Tasks:**

1. Parse token usage from OpenCode Zen responses.
2. Support cached tokens if provider includes them.
3. Estimate tokens if provider usage is missing, with `usageSource='estimated'`.
4. Estimate cost from `ModelPricing`.
5. Compute savings:
   - free model savings vs configured baseline model
   - cache savings using input price minus cached read/write price
6. Store `UsageEvent` for success/error.
7. Update `UsageDailyAggregate`.
8. Enforce hard monthly/daily budgets before call using estimated worst-case/reservation.
9. Reconcile actual spend after call.
10. Add budget controls at team/member/API-key/provider-key/model/model-group levels.
11. Add alert thresholds in DB; actual external notifications can be later.
12. Build Budgets UI.

**Verification:**

- Test: free model cost is zero.
- Test: paid model cost = tokens / 1M * price.
- Test: cache savings are calculated correctly.
- Test: budget hard limit blocks request.
- Test: daily aggregate updates correctly.
- Test: team isolation in budget queries.

---

## Sprint 10 — Statistics dashboard

**Objective:** Build comprehensive usage/cost analytics.

**Files:**

- Create `stats.service.ts`.
- Create `stats.routes.ts`.
- Create chart components and `StatsPage.tsx`.

**Tasks:**

1. Implement overview endpoint.
2. Implement time-series endpoint.
3. Implement model breakdown.
4. Implement model group breakdown.
5. Implement user/API-key/provider-key breakdown.
6. Implement latency percentiles and error breakdown.
7. Implement savings and cache stats.
8. Implement CSV export for usage events/aggregates.
9. Build Stats UI with date range and filters.
10. Add drilldowns from dashboard cards to filtered stats pages.

**Verification:**

- Test: stats endpoint respects team isolation.
- Test: filters by date/model/model group/user/API key/provider key.
- Test: CSV export has expected columns.
- Test: latency p50/p95 calculations are correct.
- UI tests for stats cards and charts with mocked data.

---

## Sprint 11 — Professional dashboard polish and i18n completeness

**Objective:** Make the app production-quality and fully bilingual.

**Files:**

- All web pages/components.
- `apps/web/src/i18n/en/common.json`
- `apps/web/src/i18n/es/common.json`

**Tasks:**

1. Install/configure shadcn/ui components.
2. Implement AppShell with sidebar, breadcrumbs, team switcher, locale switcher, and dark mode.
3. Use Tailwind 4 class-based dark mode with `@custom-variant dark (&:where(.dark, .dark *));` and an HTML-head sync IIFE to avoid FOUC.
4. Replace placeholder homepage with dashboard routing.
5. Ensure every visible string uses i18n keys.
6. Add empty states, loading skeletons, error states.
7. Add destructive action confirmations.
8. Add toasts for mutations.
9. Add professional docs snippets for `/v1/chat/completions`.
10. Add API examples for curl, OpenAI SDK, OpenCode, and generic agents.
11. Add responsive layout for mobile/tablet.

**Verification:**

- Search for hardcoded user-visible strings outside translation files.
- EN and ES pages render.
- Dark mode toggles without FOUC.
- `pnpm --filter @llm-router/web test:run` passes.
- `pnpm --filter @llm-router/web build` passes.

---

## Sprint 12 — Security hardening and auditability

**Objective:** Make secrets, permissions, logs, and audit trails production-safe.

**Files:**

- Security middleware.
- Audit service/routes.
- Rate limit middleware.
- Redaction utilities.
- Docs.

**Tasks:**

1. Add Helmet/security headers.
2. Add configurable CORS.
3. Add rate limiting on auth and `/v1/*`.
4. Redact secrets in logs/errors.
5. Hash IP and user-agent in audit logs.
6. Audit-log sensitive mutations.
7. Add team isolation tests for every route family.
8. Add permission matrix tests.
9. Add no-plaintext-secret regression tests.
10. Add docs for key management and provider privacy caveats.

**Verification:**

- Security tests pass.
- No API route leaks provider API keys.
- Team isolation tests pass.
- Audit log captures sensitive changes.

---

## Sprint 13 — Production readiness: Docker, Fly.io, CI, backups

**Objective:** Make the platform deployable and maintainable.

**Files:**

- Create `Dockerfile`
- Create `fly.toml`
- Create `.github/workflows/ci.yml`
- Create `.github/workflows/deploy.yml`
- Create `apps/server/src/scripts/backup-sqlite.ts`
- Create docs under `docs/`
- Create/update `.env.example`

**Tasks:**

1. Multi-stage Docker build for pnpm monorepo.
2. Serve web dist through Express in production.
3. Configure SQLite persistent volume path.
4. Add `/api/health` and `/api/ready` readiness checks.
5. Add startup migration runner.
6. Add GitHub Actions CI: install, type-check, test, build.
7. Add deploy workflow to Fly.io.
8. Add backup/export script for SQLite.
9. Add restore documentation.
10. Add production env var docs.
11. Add Fly.io volume and scale-to-zero notes if appropriate.

**Verification:**

- Docker image builds locally.
- Container starts and serves web + API.
- CI passes.
- Fly deployment health check passes.
- Backup script creates a restorable SQLite export.

---

## Sprint 14 — End-to-end acceptance and launch checklist

**Objective:** Prove the platform works end-to-end before declaring production-ready.

**Tasks:**

1. Register an admin user.
2. Create a team.
3. Add an OpenCode Zen provider key.
4. Sync model catalog.
5. Create a platform API key.
6. Verify `/v1/models` returns aliases and concrete models.
7. Call `/v1/chat/completions` with a concrete free model.
8. Call `/v1/chat/completions` with `model='free-coding'`.
9. Repeat with same `X-Session-Id` and verify sticky model reuse.
10. Set a low budget and verify hard-limit blocking.
11. Verify usage event and aggregate are stored.
12. Verify stats dashboard reflects usage/cost/savings.
13. Verify audit log contains key/provider/budget/model group actions.
14. Verify English and Spanish UI.
15. Verify Docker/Fly production health.

**Verification commands:**

```bash
pnpm type-check
pnpm test:run
pnpm build
pnpm --filter @llm-router/server test:run
pnpm --filter @llm-router/web test:run
git status --short
```

Manual/API-level checks:

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/ready
curl -s -H "Authorization: Bearer $LLM_ROUTER_API_KEY" http://localhost:3001/v1/models
curl -s -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer $LLM_ROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: demo-session" \
  -d '{"model":"free-coding","messages":[{"role":"user","content":"Write a TypeScript debounce function"}]}'
```

---

## 9. Testing Strategy

### Backend

Unit tests:

- password hashing
- API key generation/hashing
- provider key encryption/decryption
- provider key selection
- model catalog sync/merge
- pricing/cost calculation
- savings calculation
- budget enforcement
- model group resolution
- sticky session derivation and reuse
- OpenAI-compatible error formatting

Integration tests:

- auth flows
- team and role flows
- API key auth
- provider key CRUD and validation
- `/v1/models`
- `/v1/chat/completions` with mocked OpenCode Zen
- streaming SSE proxy with mocked OpenCode Zen
- usage aggregation
- stats filtering/export
- audit log creation

Security tests:

- team isolation for every route family
- revoked/expired keys
- disabled provider keys
- role access control
- no plaintext secrets in DB/API responses
- prompts not logged by default

### Frontend

- Render tests for all pages.
- i18n tests for EN/ES.
- Form tests for API key/provider key/model group/budget creation.
- Stats dashboard tests with mocked API data.
- Protected route tests.
- Empty/loading/error state tests.

### E2E/API verification

Use curl/httpie and mocked or real OpenCode Zen key when available. Do not rely only on visual browser checks.

---

## 10. Security Requirements

- Never store provider keys or platform API keys in plaintext.
- Platform keys stored as hash only.
- Provider keys encrypted with `ENCRYPTION_KEY`.
- Full platform key shown only once after creation.
- Audit log all sensitive changes.
- Strict team isolation in every query.
- Role-based access on every dashboard route.
- CORS configurable by env.
- Rate limiting on auth and `/v1/*` routes.
- Redact secrets in logs.
- Do not log prompts by default.
- If future prompt logging is added, it must be opt-in per team and clearly marked.
- Store session IDs as hashes only.
- Include OpenCode Zen privacy caveats for free/trial models in UI/docs.
- Add security headers in production.

---

## 11. Production Environment Variables

Add to `.env.example`:

```bash
NODE_ENV=production
PORT=3001
DATABASE_PATH=/data/llm-router.sqlite
JWT_SECRET=change-me-long-random-secret
ENCRYPTION_KEY=base64-32-byte-key
CORS_ORIGIN=https://your-domain.example
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-on-first-login
OPENCODE_ZEN_SYNC_ENABLED=true
OPENCODE_ZEN_BASE_URL=https://opencode.ai/zen/v1
DEFAULT_MONTHLY_BUDGET_USD=20
DEFAULT_DAILY_BUDGET_USD=5
DEFAULT_RATE_LIMIT_RPM=60
LOG_LEVEL=info
TRUST_PROXY=true
```

---

## 12. Acceptance Criteria

The platform is production-ready when:

- A user can register/login and create a team.
- A user can create a platform API key and use it with `/v1/chat/completions`.
- A team admin can add multiple OpenCode Zen provider keys.
- Provider keys are encrypted and selected by health, priority, limits, and budget.
- A team admin can sync and manage the OpenCode Zen model catalog.
- Current free OpenCode Zen models are stored with zero cost and pricing confidence/source.
- Paid models have stored pricing with source/date.
- A team admin can create/edit model groups like `coding` and `free-coding`.
- Requests to a model group route to concrete endpoint-compatible OpenCode Zen models.
- Same session requests attempt to reuse the same concrete model.
- Spend is tracked and hard budgets are enforced.
- Statistics show requests, tokens, cached tokens, cost, savings, latency, errors, models, model groups, users, platform API keys, and provider keys.
- CSV export works.
- Audit log captures sensitive changes.
- Dashboard is available in English and Spanish.
- Tests, type-check, and build pass.
- Docker/Fly deployment works with persistent SQLite.
- Backup/export works.
- No secrets are stored or displayed insecurely.
- Prompts are not logged by default.

---

## 13. Suggested Implementation Order

Implement in this exact order:

1. Sprint 0: tests/hygiene
2. Sprint 1: DB/entities/migrations/seeds
3. Sprint 2: auth/teams/roles/invitations
4. Sprint 3: platform API keys
5. Sprint 4: OpenCode provider key pool
6. Sprint 5: models/pricing/sync
7. Sprint 6: model groups/routing
8. Sprint 7: sticky session affinity
9. Sprint 8: `/v1/chat/completions`
10. Sprint 9: usage/cost/savings/budgets
11. Sprint 10: stats
12. Sprint 11: UI polish/i18n/docs
13. Sprint 12: security hardening
14. Sprint 13: production deployment
15. Sprint 14: final E2E acceptance

After each sprint:

```bash
pnpm type-check
pnpm test:run
pnpm build
git status --short
git diff --stat HEAD~1..HEAD
```

Then audit the sprint checklist before marking complete.

---

## 14. Plan Completeness Notes

This revised plan fixes the gaps in the earlier draft:

- Adds current live OpenCode Zen model list from `/zen/v1/models`.
- Adds additional currently listed `*-free` models with pricing-confidence handling.
- Distinguishes chat-compatible models from Responses/Messages/Google endpoint families.
- Adds provider key health, cooldown, validation, and rate limits.
- Adds `BudgetLedger` for safer budget enforcement.
- Adds endpoint compatibility to routing/model groups.
- Adds security hardening as its own sprint.
- Adds final E2E launch sprint.
- Adds budget UI and docs page explicitly.
- Fixes malformed curl examples.
- Adds no-prompt-logging and hashed-session requirements.
- Adds pricing confidence/source fields so savings statistics are auditable.
