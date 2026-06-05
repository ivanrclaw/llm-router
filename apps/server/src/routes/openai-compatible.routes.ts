import { Router } from "express";
import type { DataSource } from "typeorm";
import { apiKeyAuth } from "../middleware/api-key-auth.js";

export function createOpenAiCompatibleRouter(dataSource: DataSource): Router {
  const router = Router();

  router.get("/models", apiKeyAuth(dataSource, "models:read"), async (_req, res, next) => {
    try {
      const models = await dataSource.query(
        `select pm.externalModelId as id, pm.createdAt as createdAt, p.slug as provider
         from provider_models pm join providers p on p.id = pm.providerId
         where pm.isEnabled = 1 and p.isEnabled = 1
         order by pm.externalModelId asc`,
      );
      const groups = await dataSource.query(
        "select alias as id, createdAt from model_groups where isEnabled = 1 order by alias asc",
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

  return router;
}
