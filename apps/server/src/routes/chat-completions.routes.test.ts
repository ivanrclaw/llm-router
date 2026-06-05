import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedOpenCodeZenModels } from "../seeds/index.js";
import { ProviderKeyService } from "../services/provider-key.service.js";
import { ModelGroupService } from "../services/model-group.service.js";

async function createServerFixture() {
  const dataSource = await createMigratedTestDataSource("chat-completions-test");
  await seedOpenCodeZenModels(dataSource);
  const app = createApp({ dataSource });
  const register = await request(app).post("/api/auth/register").send({
    email: "chat-owner@example.com",
    name: "Chat Owner",
    password: "secure-password-123",
    teamName: "Chat Team",
  });
  const token = register.body.token as string;
  const teamId = register.body.teams[0].id as string;
  await new ModelGroupService(dataSource).ensureDefaultGroups(teamId);
  const providerKey = await new ProviderKeyService(dataSource).create(register.body.user.id, teamId, {
    name: "OpenCode Zen primary",
    providerSlug: "opencode-zen",
    key: "oz_primary_secret",
    priority: 10,
  });
  const platformKey = await request(app)
    .post(`/api/teams/${teamId}/api-keys`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Chat client", scopes: ["models:read", "chat:write"] });
  return { dataSource, app, teamId, providerKey, platformKey: platformKey.body.apiKey.key as string };
}

function chatPayload(overrides: Record<string, unknown> = {}) {
  return {
    model: "coding",
    messages: [{ role: "user", content: "Say hello" }],
    temperature: 0.2,
    ...overrides,
  };
}

describe("OpenAI-compatible chat completions proxy", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (dataSource?.isInitialized) await dataSource.destroy();
    dataSource = undefined;
  });

  it("forwards non-streaming chat completion requests to OpenCode Zen and preserves OpenAI response shape", async () => {
    const fixture = await createServerFixture();
    dataSource = fixture.dataSource;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chatcmpl_123",
          object: "chat.completion",
          created: 1710000000,
          model: "big-pickle",
          choices: [{ index: 0, message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .set("X-Session-Id", "session-alpha")
      .send(chatPayload());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ object: "chat.completion", model: "big-pickle" });
    expect(response.body.choices[0].message.content).toBe("hello");
    expect(response.headers["x-llm-router-requested-model"]).toBe("coding");
    const resolvedModel = response.headers["x-llm-router-resolved-model"];
    expect(resolvedModel).toBeTruthy();
    expect(response.headers["x-llm-router-provider"]).toBe("opencode-zen");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall!;
    expect(String(url)).toBe("https://opencode.ai/zen/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer oz_primary_secret");
    const forwardedBody = JSON.parse(String(init?.body));
    expect(forwardedBody.model).toBe(resolvedModel);
    expect(forwardedBody.messages[0].content).toBe("Say hello");
  });

  it("streams provider SSE without buffering and attaches router metadata headers", async () => {
    const fixture = await createServerFixture();
    dataSource = fixture.dataSource;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\ndata: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const response = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send(chatPayload({ stream: true }));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.headers["x-llm-router-resolved-model"]).toBeTruthy();
    expect(response.text).toContain("data:");
    expect(response.text).toContain("[DONE]");
  });

  it("returns OpenAI-compatible errors for invalid model and non-chat endpoint models", async () => {
    const fixture = await createServerFixture();
    dataSource = fixture.dataSource;
    const missing = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send(chatPayload({ model: "missing-model" }));
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({ type: "invalid_request_error", code: "model_not_found" });

    await dataSource.query(
      `insert into provider_models (id, providerId, externalModelId, displayName, endpointType, tagsJson, capabilitiesJson, isFree, isEnabled, pricingConfidence, metadataJson)
       select 'non-chat-sprint8', providerId, 'embed-only-free', 'Embed Only Free', 'google_model_endpoint', '["free"]', '{}', 1, 1, 'live_model_id_inferred', '{}' from provider_models limit 1`,
    );
    const nonChat = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send(chatPayload({ model: "embed-only-free" }));
    expect(nonChat.status).toBe(400);
    expect(nonChat.body.error).toMatchObject({ type: "invalid_request_error", code: "endpoint_incompatible" });
  });

  it("marks provider 429 failures and retries fallback provider key", async () => {
    const fixture = await createServerFixture();
    dataSource = fixture.dataSource;
    await new ProviderKeyService(dataSource).create("", fixture.teamId, {
      name: "OpenCode Zen fallback",
      providerSlug: "opencode-zen",
      key: "oz_fallback_secret",
      priority: 20,
    }).catch(async () => {
      const user = await dataSource!.query("select id from users limit 1");
      await new ProviderKeyService(dataSource!).create(user[0].id, fixture.teamId, { name: "OpenCode Zen fallback", providerSlug: "opencode-zen", key: "oz_fallback_secret", priority: 20 });
    });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ok", object: "chat.completion", created: 1, model: "big-pickle", choices: [{ index: 0, message: { role: "assistant", content: "fallback" }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } }));

    const response = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send(chatPayload());

    expect(response.status).toBe(200);
    expect(response.body.choices[0].message.content).toBe("fallback");
    const rows = await dataSource.query("select keyPrefix, healthStatus, lastErrorCode, cooldownUntil from provider_api_keys order by priority asc");
    expect(rows[0].healthStatus).toBe("rate_limited");
    expect(rows[0].lastErrorCode).toBe("provider_429");
    expect(rows[0].cooldownUntil).toBeTruthy();
  });

  it("validates request body and never stores prompt or provider secrets in audit/session tables", async () => {
    const fixture = await createServerFixture();
    dataSource = fixture.dataSource;
    const invalid = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send({ model: "coding", messages: [{ role: "alien", content: "invalid" }] });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.type).toBe("invalid_request_error");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "ok", object: "chat.completion", created: 1, model: "big-pickle", choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } }));
    await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .set("X-Session-Id", "raw-sensitive-session")
      .send(chatPayload({ messages: [{ role: "user", content: "SECRET_PROMPT_SHOULD_NOT_PERSIST" }] }));
    const sessionRows = await dataSource.query("select * from session_affinities");
    const auditRows = await dataSource.query("select * from audit_logs");
    const stored = JSON.stringify({ sessionRows, auditRows });
    expect(stored).not.toContain("SECRET_PROMPT_SHOULD_NOT_PERSIST");
    expect(stored).not.toContain("raw-sensitive-session");
    expect(stored).not.toContain("oz_primary_secret");
  });
});
