import { Router } from "express";
import type { Request, Response as ExpressResponse } from "express";
import type { DataSource } from "typeorm";
import { z } from "zod";
import { apiKeyAuth, type ApiKeyAuthenticatedRequest } from "../middleware/api-key-auth.js";
import { OpenCodeZenAdapter, OPENCODE_ZEN_SLUG } from "../providers/opencode-zen.adapter.js";
import { ModelCatalogService } from "../services/model-catalog.service.js";
import { ProviderKeyService } from "../services/provider-key.service.js";
import { RouterService } from "../services/router.service.js";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.unknown())]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
}).passthrough();

const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(messageSchema).min(1),
  stream: z.boolean().optional().default(false),
}).passthrough();

function openAiError(res: ExpressResponse, status: number, code: string, message: string) {
  res.status(status).json({ error: { message, type: "invalid_request_error", code } });
}

async function writeProviderResponse(res: ExpressResponse, providerResponse: globalThis.Response, stream: boolean) {
  if (stream) {
    res.status(providerResponse.status);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (providerResponse.body) {
      const reader = providerResponse.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      } finally {
        res.end();
      }
      return;
    }
    res.end(await providerResponse.text());
    return;
  }
  const contentType = providerResponse.headers.get("content-type") ?? "application/json";
  res.status(providerResponse.status).setHeader("Content-Type", contentType);
  const text = await providerResponse.text();
  if (contentType.includes("application/json")) {
    try {
      res.json(JSON.parse(text));
      return;
    } catch {}
  }
  res.send(text);
}

export function createOpenAiCompatibleRouter(dataSource: DataSource): Router {
  const router = Router();

  router.get("/models", apiKeyAuth(dataSource, "models:read"), async (req, res, next) => {
    try {
      const models = await dataSource.query(
        `select pm.externalModelId as id, pm.createdAt as createdAt, p.slug as provider
         from provider_models pm join providers p on p.id = pm.providerId
         where pm.isEnabled = 1 and p.isEnabled = 1 and pm.endpointType = 'openai_chat_completions' and pm.deprecatedAt is null
         order by pm.externalModelId asc`,
      );
      const teamId = (req as ApiKeyAuthenticatedRequest).platformApiKey.teamId;
      const groups = await dataSource.query(
        "select alias as id, createdAt from model_groups where isEnabled = 1 and (teamId = ? or teamId is null) order by alias asc",
        [teamId],
      );
      res.json({
        object: "list",
        data: [
          ...models.map((model: { id: string; createdAt: string; provider: string }) => ({
            id: model.id,
            object: "model",
            created: Math.floor(new Date(model.createdAt).getTime() / 1000) || 0,
            owned_by: model.provider,
          })),
          ...groups.map((group: { id: string; createdAt: string }) => ({
            id: group.id,
            object: "model",
            created: Math.floor(new Date(group.createdAt).getTime() / 1000) || 0,
            owned_by: "llm-router",
            metadata: { llm_router_type: "model_group" },
          })),
        ],
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/chat/completions", apiKeyAuth(dataSource, "chat:write"), async (req: Request, res: ExpressResponse, next) => {
    try {
      const parsed = chatCompletionSchema.safeParse(req.body);
      if (!parsed.success) {
        openAiError(res, 400, "invalid_request", "Invalid chat completion request");
        return;
      }
      const platformApiKey = (req as ApiKeyAuthenticatedRequest).platformApiKey;
      const requestedModel = parsed.data.model;
      const catalog = new ModelCatalogService(dataSource);
      const sameExternal = (await catalog.list({ provider: OPENCODE_ZEN_SLUG })).find((model) => model.externalModelId === requestedModel);
      if (sameExternal && sameExternal.endpointType !== "openai_chat_completions") {
        openAiError(res, 400, "endpoint_incompatible", "Requested model is not compatible with chat completions");
        return;
      }
      let resolved;
      try {
        resolved = await new RouterService(dataSource).resolve({
          teamId: platformApiKey.teamId,
          platformApiKeyId: platformApiKey.id,
          requestedModel,
          endpointType: "openai_chat_completions",
          session: {
            headerSessionId: req.header("x-session-id") ?? null,
            metadataSessionId: typeof req.body?.metadata?.session_id === "string" ? req.body.metadata.session_id : null,
            userId: typeof req.body?.user === "string" ? req.body.user : null,
            fallbackSeed: requestedModel,
          },
        });
      } catch (error) {
        const err = error as { code?: string; message?: string };
        const normalizedCode = err.code === "no_route_candidate" || err.code === "model_group_not_found" ? "model_not_found" : err.code ?? "model_not_found";
        openAiError(res, 404, normalizedCode, err.message ?? "Model not found");
        return;
      }
      res.setHeader("X-LLM-Router-Requested-Model", requestedModel);
      res.setHeader("X-LLM-Router-Resolved-Model", resolved.externalModelId);
      res.setHeader("X-LLM-Router-Provider", resolved.providerSlug);
      const providerKeyService = new ProviderKeyService(dataSource);
      const adapter = new OpenCodeZenAdapter();
      const attempted: string[] = [];
      const providerPayload = { ...parsed.data, model: resolved.externalModelId };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const providerKey = await providerKeyService.selectUsableKey({ teamId: platformApiKey.teamId, providerSlug: resolved.providerSlug, excludeKeyIds: attempted });
        if (!providerKey) {
          openAiError(res, 503, "provider_key_unavailable", "No usable provider API key available");
          return;
        }
        attempted.push(providerKey.id);
        const providerResponse = await adapter.chatCompletions(providerKey.plaintextKey, providerPayload);
        if (providerResponse.ok) {
          await writeProviderResponse(res, providerResponse, !!parsed.data.stream);
          return;
        }
        if (providerResponse.status === 429 || providerResponse.status >= 500) {
          await providerKeyService.markProviderFailure(platformApiKey.teamId, providerKey.id, providerResponse.status);
          continue;
        }
        const bodyText = await providerResponse.text();
        res.status(providerResponse.status).json({ error: { message: bodyText || "Provider error", type: "invalid_request_error", code: `provider_${providerResponse.status}` } });
        return;
      }
      openAiError(res, 503, "provider_unavailable", "Provider unavailable after retries");
    } catch (error) {
      next(error);
    }
  });

  return router;
}
