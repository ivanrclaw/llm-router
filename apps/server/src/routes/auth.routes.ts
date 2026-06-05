import { Router } from "express";
import type { DataSource } from "typeorm";
import { dashboardAuth, type AuthenticatedRequest } from "../middleware/dashboard-auth.js";
import { AuthService } from "../services/auth.service.js";

export function createAuthRouter(dataSource: DataSource): Router {
  const router = Router();
  const authService = new AuthService(dataSource);
  const requireAuth = dashboardAuth(dataSource);

  router.post("/register", async (req, res, next) => {
    try {
      const session = await authService.register(req.body);
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const session = await authService.login(req.body.email, req.body.password);
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", requireAuth, (_req, res) => {
    res.status(204).send();
  });

  router.get("/me", requireAuth, async (req, res, next) => {
    try {
      const session = await authService.getSessionForUser((req as AuthenticatedRequest).user.id);
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/me", requireAuth, async (req, res, next) => {
    try {
      const user = await authService.updateMe((req as AuthenticatedRequest).user.id, req.body);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
