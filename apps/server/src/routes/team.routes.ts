import { Router } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { InvitationService } from "../services/invitation.service.js";
import { TeamService, type TeamRole } from "../services/team.service.js";

export function createTeamRouter(dataSource: DataSource): Router {
  const router = Router();
  const requireAuth = dashboardAuth(dataSource);
  const teamService = new TeamService(dataSource);
  const invitationService = new InvitationService(dataSource);

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      res.json({ teams: await teamService.listTeams((req as unknown as AuthenticatedRequest).user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const team = await teamService.createTeam((req as unknown as AuthenticatedRequest).user.id, req.body);
      res.status(201).json({ team });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:teamId", async (req, res, next) => {
    try {
      res.json({ team: await teamService.getTeamForUser((req as unknown as AuthenticatedRequest).user.id, req.params.teamId) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:teamId", async (req, res, next) => {
    try {
      const team = await teamService.updateTeam((req as unknown as AuthenticatedRequest).user.id, req.params.teamId, req.body);
      res.json({ team });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:teamId/members", async (req, res, next) => {
    try {
      const members = await teamService.listMembers((req as unknown as AuthenticatedRequest).user.id, req.params.teamId);
      res.json({ members });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:teamId/invitations", async (req, res, next) => {
    try {
      const invitation = await invitationService.createInvitation((req as unknown as AuthenticatedRequest).user.id, req.params.teamId, req.body);
      res.status(201).json(invitation);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:teamId/members/:memberId", async (req, res, next) => {
    try {
      const member = await teamService.updateMemberRole(
        (req as unknown as AuthenticatedRequest).user.id,
        req.params.teamId,
        req.params.memberId,
        req.body.role as TeamRole,
      );
      res.json({ member });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:teamId/members/:memberId", async (req, res, next) => {
    try {
      await teamService.removeMember((req as unknown as AuthenticatedRequest).user.id, req.params.teamId, req.params.memberId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
