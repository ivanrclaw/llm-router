import { Router, type Request } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { ModelGroupService } from "../services/model-group.service.js";
import { TeamService } from "../services/team.service.js";

function teamIdFrom(req: Request): string { return String((req.params as Record<string, string | undefined>).teamId ?? ""); }
function groupIdFrom(req: Request): string { return String((req.params as Record<string, string | undefined>).groupId ?? ""); }

export function createModelGroupRouter(dataSource: DataSource): Router {
  const router = Router({ mergeParams: true });
  const service = new ModelGroupService(dataSource);
  const teamService = new TeamService(dataSource);
  router.use(dashboardAuth(dataSource));

  router.get("/", async (req, res, next) => {
    try {
      const auth = req as unknown as AuthenticatedRequest;
      const teamId = teamIdFrom(req);
      await teamService.requireRole(auth.user.id, teamId, "viewer");
      await service.ensureDefaultGroups(teamId);
      res.json({ groups: await service.list(teamId) });
    } catch (error) { next(error); }
  });

  router.post("/validate", async (req, res, next) => {
    try {
      const auth = req as unknown as AuthenticatedRequest;
      const teamId = teamIdFrom(req);
      await teamService.requireRole(auth.user.id, teamId, "viewer");
      res.json({ warnings: await service.validateCandidates(req.body.policy ?? {}, req.body.candidates ?? []) });
    } catch (error) { next(error); }
  });

  router.post("/", async (req, res, next) => {
    try {
      const auth = req as unknown as AuthenticatedRequest;
      const teamId = teamIdFrom(req);
      await teamService.requireRole(auth.user.id, teamId, "admin");
      res.status(201).json({ group: await service.create(teamId, req.body) });
    } catch (error) { next(error); }
  });

  router.patch("/:groupId", async (req, res, next) => {
    try {
      const auth = req as unknown as AuthenticatedRequest;
      const teamId = teamIdFrom(req);
      await teamService.requireRole(auth.user.id, teamId, "admin");
      res.json({ group: await service.update(teamId, groupIdFrom(req), req.body) });
    } catch (error) { next(error); }
  });

  router.delete("/:groupId", async (req, res, next) => {
    try {
      const auth = req as unknown as AuthenticatedRequest;
      const teamId = teamIdFrom(req);
      await teamService.requireRole(auth.user.id, teamId, "admin");
      await service.delete(teamId, groupIdFrom(req));
      res.status(204).end();
    } catch (error) { next(error); }
  });

  return router;
}
