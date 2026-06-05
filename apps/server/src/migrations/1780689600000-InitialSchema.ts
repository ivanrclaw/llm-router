import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1780689600000 implements MigrationInterface {
  name = "InitialSchema1780689600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create table if not exists users (id text primary key not null, email text not null, name text not null, passwordHash text not null, locale text not null default 'en', timezone text not null default 'UTC', isActive integer not null default 1, lastLoginAt datetime null, createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_users_email on users(email)`);

    await queryRunner.query(`create table if not exists teams (id text primary key not null, name text not null, slug text not null, ownerId text not null, defaultMonthlyBudgetUsdCents integer null, defaultDailyBudgetUsdCents integer null, createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_teams_slug on teams(slug)`);

    await queryRunner.query(`create table if not exists team_members (id text primary key not null, teamId text not null, userId text not null, role text not null, monthlyBudgetUsdCents integer null, dailyBudgetUsdCents integer null, isActive integer not null default 1, createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_team_members_team_user on team_members(teamId, userId)`);

    await queryRunner.query(`create table if not exists invitations (id text primary key not null, teamId text not null, email text not null, role text not null, tokenHash text not null, expiresAt datetime not null, acceptedAt datetime null, createdByUserId text not null, createdAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create index if not exists IDX_invitations_team_email on invitations(teamId, email)`);

    await queryRunner.query(`create table if not exists platform_api_keys (id text primary key not null, teamId text not null, userId text not null, name text not null, keyPrefix text not null, keyHash text not null, scopesJson text not null default '[]', monthlyBudgetUsdCents integer null, dailyBudgetUsdCents integer null, rateLimitRpm integer null, lastUsedAt datetime null, expiresAt datetime null, revokedAt datetime null, createdAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_platform_api_keys_hash on platform_api_keys(keyHash)`);
    await queryRunner.query(`create index if not exists IDX_platform_api_keys_team_user_revoked on platform_api_keys(teamId, userId, revokedAt)`);

    await queryRunner.query(`create table if not exists providers (id text primary key not null, slug text not null, displayName text not null, baseUrl text not null, isEnabled integer not null default 1, createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_providers_slug on providers(slug)`);

    await queryRunner.query(`create table if not exists provider_api_keys (id text primary key not null, teamId text not null, providerId text not null, name text not null, keyPrefix text not null, encryptedKey text not null, priority integer not null default 100, monthlyBudgetUsdCents integer null, dailyBudgetUsdCents integer null, rpmLimit integer null, isEnabled integer not null default 1, healthStatus text not null default 'unknown', lastValidatedAt datetime null, lastUsedAt datetime null, lastErrorAt datetime null, lastErrorCode text null, cooldownUntil datetime null, revokedAt datetime null, createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create index if not exists IDX_provider_api_keys_select on provider_api_keys(teamId, providerId, isEnabled, priority)`);
    await queryRunner.query(`create index if not exists IDX_provider_api_keys_cooldown on provider_api_keys(cooldownUntil)`);

    await queryRunner.query(`create table if not exists provider_models (id text primary key not null, providerId text not null, externalModelId text not null, displayName text not null, endpointType text not null, contextWindowTokens integer null, tagsJson text not null default '[]', capabilitiesJson text not null default '{}', isFree integer not null default 0, isEnabled integer not null default 1, pricingConfidence text not null default 'unknown', metadataJson text not null default '{}', deprecatedAt datetime null, createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_provider_models_provider_external on provider_models(providerId, externalModelId)`);
    await queryRunner.query(`create index if not exists IDX_provider_models_endpoint on provider_models(providerId, endpointType, isEnabled)`);

    await queryRunner.query(`create table if not exists model_pricings (id text primary key not null, providerModelId text not null, currency text not null default 'USD', inputUsdPer1M real not null, outputUsdPer1M real not null, cachedReadUsdPer1M real null, cachedWriteUsdPer1M real null, isFree integer not null default 0, pricingConfidence text not null default 'unknown', sourceUrl text not null, sourceUpdatedAt datetime not null, effectiveFrom datetime not null, effectiveTo datetime null, createdAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create index if not exists IDX_model_pricings_effective on model_pricings(providerModelId, effectiveFrom, effectiveTo)`);

    await queryRunner.query(`create table if not exists model_groups (id text primary key not null, teamId text null, alias text not null, displayName text not null, description text null, policyJson text not null default '{}', stickySessionTtlSeconds integer not null default 86400, isEnabled integer not null default 1, createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_model_groups_team_alias on model_groups(teamId, alias)`);

    await queryRunner.query(`create table if not exists model_group_candidates (id text primary key not null, modelGroupId text not null, providerModelId text not null, priority integer not null default 100, weight integer not null default 1, isEnabled integer not null default 1, constraintsJson text not null default '{}', createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create index if not exists IDX_model_group_candidates_order on model_group_candidates(modelGroupId, priority, weight)`);

    await queryRunner.query(`create table if not exists session_affinities (id text primary key not null, teamId text not null, platformApiKeyId text not null, requestedModel text not null, sessionKeyHash text not null, providerId text not null, providerModelId text not null, lastProviderApiKeyId text null, expiresAt datetime not null, hitCount integer not null default 0, failureCount integer not null default 0, isDegraded integer not null default 0, firstSeenAt datetime not null default CURRENT_TIMESTAMP, lastSeenAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_session_affinities_key on session_affinities(teamId, platformApiKeyId, requestedModel, sessionKeyHash)`);
    await queryRunner.query(`create index if not exists IDX_session_affinities_expires on session_affinities(expiresAt)`);

    await queryRunner.query(`create table if not exists usage_events (id text primary key not null, requestId text not null, teamId text not null, userId text not null, platformApiKeyId text not null, providerId text not null, providerApiKeyId text null, providerModelId text not null, requestedModel text not null, resolvedModel text not null, sessionKeyHash text null, status text not null, errorCode text null, httpStatus integer null, promptTokens integer not null default 0, completionTokens integer not null default 0, cachedReadTokens integer not null default 0, cachedWriteTokens integer not null default 0, totalTokens integer not null default 0, latencyMs integer not null default 0, costUsdCents integer not null default 0, savedUsdCents integer not null default 0, baselineModelId text null, usageSource text not null default 'unavailable', isStreaming integer not null default 0, createdAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create index if not exists IDX_usage_events_team_created on usage_events(teamId, createdAt)`);
    await queryRunner.query(`create index if not exists IDX_usage_events_user_created on usage_events(userId, createdAt)`);
    await queryRunner.query(`create index if not exists IDX_usage_events_platform_key_created on usage_events(platformApiKeyId, createdAt)`);
    await queryRunner.query(`create index if not exists IDX_usage_events_model_created on usage_events(providerModelId, createdAt)`);
    await queryRunner.query(`create index if not exists IDX_usage_events_provider_key_created on usage_events(providerApiKeyId, createdAt)`);

    await queryRunner.query(`create table if not exists usage_daily_aggregates (id text primary key not null, date text not null, teamId text not null, userId text null, platformApiKeyId text null, modelId text null, providerApiKeyId text null, requestCount integer not null default 0, successCount integer not null default 0, errorCount integer not null default 0, promptTokens integer not null default 0, completionTokens integer not null default 0, cachedReadTokens integer not null default 0, cachedWriteTokens integer not null default 0, costUsdCents integer not null default 0, savedUsdCents integer not null default 0, avgLatencyMs integer not null default 0, p50LatencyMs integer not null default 0, p95LatencyMs integer not null default 0)`);
    await queryRunner.query(`create index if not exists IDX_usage_daily_aggregates_dims on usage_daily_aggregates(date, teamId, userId, modelId, platformApiKeyId, providerApiKeyId)`);

    await queryRunner.query(`create table if not exists budget_policies (id text primary key not null, scopeType text not null, scopeId text not null, monthlyBudgetUsdCents integer null, dailyBudgetUsdCents integer null, hardLimit integer not null default 1, alertThresholdsJson text not null default '[]', createdAt datetime not null default CURRENT_TIMESTAMP, updatedAt datetime not null default CURRENT_TIMESTAMP)`);

    await queryRunner.query(`create table if not exists budget_ledgers (id text primary key not null, scopeType text not null, scopeId text not null, periodType text not null, periodKey text not null, spentUsdCents integer not null default 0, reservedUsdCents integer not null default 0, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create unique index if not exists IDX_budget_ledgers_scope_period on budget_ledgers(scopeType, scopeId, periodType, periodKey)`);

    await queryRunner.query(`create table if not exists audit_logs (id text primary key not null, teamId text not null, actorUserId text null, action text not null, resourceType text not null, resourceId text null, ipHash text null, userAgentHash text null, metadataJson text not null default '{}', createdAt datetime not null default CURRENT_TIMESTAMP)`);
    await queryRunner.query(`create index if not exists IDX_audit_logs_team_created on audit_logs(teamId, createdAt)`);

    await queryRunner.query(`create table if not exists system_settings (key text primary key not null, valueJson text not null, updatedAt datetime not null default CURRENT_TIMESTAMP)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ["system_settings", "audit_logs", "budget_ledgers", "budget_policies", "usage_daily_aggregates", "usage_events", "session_affinities", "model_group_candidates", "model_groups", "model_pricings", "provider_models", "provider_api_keys", "providers", "platform_api_keys", "invitations", "team_members", "teams", "users"]) {
      await queryRunner.query(`drop table if exists ${table}`);
    }
  }
}
