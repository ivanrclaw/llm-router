import { Router, type Request } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { ApiKeyService } from "../services/api-key.service.js";

function teamIdFrom(req: Request): string {
  return String((req.params as Record<string, string | undefined>).teamId ?? "");
}

function keyIdFrom(req: Request): string {
  return String((req.params as Record<string, string | undefined>).keyId ?? "");
}

export function createApiKeyRouter(dataSource: DataSource): Router {
  const router = Router({ mergeParams: true });
  const requireAuth = dashboardAuth(dataSource);
  const apiKeyService = new ApiKeyService(dataSource);

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const apiKeys = await apiKeyService.list((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req));
      res.json({ apiKeys });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const apiKey = await apiKeyService.create((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req), req.body);
      res.status(201).json({ apiKey });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:keyId", async (req, res, next) => {
    try {
      const apiKey = await apiKeyService.update(
        (req as unknown as AuthenticatedRequest).user.id,
        teamIdFrom(req),
        keyIdFrom(req),
        req.body,
      );
      res.json({ apiKey });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:keyId", async (req, res, next) => {
    try {
      await apiKeyService.revoke((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req), keyIdFrom(req));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
