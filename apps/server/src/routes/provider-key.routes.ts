import { Router, type Request } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { ProviderKeyService } from "../services/provider-key.service.js";
import { auditContextFromRequest } from "../services/audit-log.service.js";

function teamIdFrom(req: Request): string {
  return String((req.params as Record<string, string | undefined>).teamId ?? "");
}

function keyIdFrom(req: Request): string {
  return String((req.params as Record<string, string | undefined>).keyId ?? "");
}

export function createProviderKeyRouter(dataSource: DataSource): Router {
  const router = Router({ mergeParams: true });
  const requireAuth = dashboardAuth(dataSource);
  const service = new ProviderKeyService(dataSource);

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const providerKeys = await service.list((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req));
      res.json({ providerKeys });
    } catch (error) { next(error); }
  });

  router.post("/", async (req, res, next) => {
    try {
      const providerKey = await service.create((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req), req.body, auditContextFromRequest(req));
      res.status(201).json({ providerKey });
    } catch (error) { next(error); }
  });

  router.patch("/:keyId", async (req, res, next) => {
    try {
      const providerKey = await service.update((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req), keyIdFrom(req), req.body);
      res.json({ providerKey });
    } catch (error) { next(error); }
  });

  router.post("/:keyId/validate", async (req, res, next) => {
    try {
      const providerKey = await service.validate((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req), keyIdFrom(req));
      res.json({ providerKey });
    } catch (error) { next(error); }
  });

  router.delete("/:keyId", async (req, res, next) => {
    try {
      await service.revoke((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req), keyIdFrom(req));
      res.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
}
