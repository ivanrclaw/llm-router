import { Router, type Request } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { BudgetService, type BudgetScopeType } from "../services/budget.service.js";

function teamIdFrom(req: Request): string {
  return String((req.params as Record<string, string | undefined>).teamId ?? "");
}

function scopeTypeFrom(req: Request): BudgetScopeType {
  return String((req.params as Record<string, string | undefined>).scopeType ?? "team") as BudgetScopeType;
}

function scopeIdFrom(req: Request): string {
  return String((req.params as Record<string, string | undefined>).scopeId ?? "");
}

export function createBudgetRouter(dataSource: DataSource): Router {
  const router = Router({ mergeParams: true });
  const requireAuth = dashboardAuth(dataSource);
  const service = new BudgetService(dataSource);

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const policies = await service.list((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req));
      res.json({ policies });
    } catch (error) { next(error); }
  });

  router.put("/:scopeType/:scopeId", async (req, res, next) => {
    try {
      const policy = await service.upsert((req as unknown as AuthenticatedRequest).user.id, teamIdFrom(req), scopeTypeFrom(req), scopeIdFrom(req), req.body);
      res.json({ policy });
    } catch (error) { next(error); }
  });

  return router;
}
