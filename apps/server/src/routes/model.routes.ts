import { Router, type Request } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { ModelCatalogService, filtersFromQuery } from "../services/model-catalog.service.js";
import { AuditLogService } from "../services/audit-log.service.js";
import { TeamService } from "../services/team.service.js";

function modelIdFrom(req: Request): string { return String((req.params as Record<string, string | undefined>).modelId ?? ""); }

export function createModelRouter(dataSource: DataSource): Router {
  const router = Router();
  const requireAuth = dashboardAuth(dataSource);
  const service = new ModelCatalogService(dataSource);
  const teamService = new TeamService(dataSource);
  const auditLogService = new AuditLogService(dataSource);
  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try { res.json({ models: await service.list(filtersFromQuery(req.query as Record<string, unknown>)) }); } catch (error) { next(error); }
  });

  router.get("/chat-compatible", async (_req, res, next) => {
    try { res.json({ models: await service.listChatCompatible() }); } catch (error) { next(error); }
  });

  router.post("/sync/opencode-zen", async (req, res, next) => {
    try {
      const auth = req as unknown as AuthenticatedRequest;
      const firstTeam = (await teamService.listTeams(auth.user.id))[0];
      if (!firstTeam) throw Object.assign(new Error("Team not found"), { statusCode: 404 });
      await teamService.requireRole(auth.user.id, firstTeam.id, "admin");
      const sync = await service.syncOpenCodeZenModels();
      await auditLogService.record({ teamId: firstTeam.id, actorUserId: auth.user.id, action: "model_catalog.synced", resourceType: "model_catalog", metadata: sync });
      res.json({ sync });
    } catch (error) { next(error); }
  });

  router.patch("/:modelId", async (req, res, next) => {
    try {
      const auth = req as unknown as AuthenticatedRequest;
      const firstTeam = (await teamService.listTeams(auth.user.id))[0];
      if (!firstTeam) throw Object.assign(new Error("Team not found"), { statusCode: 404 });
      await teamService.requireRole(auth.user.id, firstTeam.id, "admin");
      res.json({ model: await service.update(modelIdFrom(req), req.body) });
    } catch (error) { next(error); }
  });

  return router;
}
