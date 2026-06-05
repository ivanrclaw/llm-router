import { Router } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { InvitationService } from "../services/invitation.service.js";

export function createInvitationRouter(dataSource: DataSource): Router {
  const router = Router();
  const requireAuth = dashboardAuth(dataSource);
  const invitationService = new InvitationService(dataSource);

  router.post("/:token/accept", requireAuth, async (req, res, next) => {
    try {
      const membership = await invitationService.acceptInvitation((req as unknown as AuthenticatedRequest).user.id, String(req.params.token));
      res.json({ membership });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
