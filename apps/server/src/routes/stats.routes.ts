import { Router, type Request, type Response } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { StatsService, type StatsFilters } from "../services/stats.service.js";

function filtersFrom(req: Request): StatsFilters {
  return {
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
    modelId: typeof req.query.modelId === "string" ? req.query.modelId : undefined,
    modelGroupId: typeof req.query.modelGroupId === "string" ? req.query.modelGroupId : undefined,
    userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
    platformApiKeyId: typeof req.query.platformApiKeyId === "string" ? req.query.platformApiKeyId : undefined,
    providerKeyId: typeof req.query.providerKeyId === "string" ? req.query.providerKeyId : undefined,
  };
}

function teamIdFrom(req: Request): string {
  const value = req.params.teamId;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function createStatsRouter(dataSource: DataSource): Router {
  const router = Router({ mergeParams: true });
  const service = new StatsService(dataSource);

  router.use(dashboardAuth(dataSource));

  router.get("/", async (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      res.json(await service.getStats(authReq.user.id, teamIdFrom(req), filtersFrom(req)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/export.csv", async (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const csv = await service.exportCsv(authReq.user.id, teamIdFrom(req), filtersFrom(req));
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", "attachment; filename=usage-events.csv");
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
