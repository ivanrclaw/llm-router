import type { NextFunction, Request, Response } from "express";
import type { DataSource } from "typeorm";
import { AuthService, type PublicUser } from "../services/auth.service.js";
import { readBearerToken, verifyDashboardToken } from "../lib/token.js";

export type AuthenticatedRequest = Request & { user: PublicUser };

export function dashboardAuth(dataSource: DataSource) {
  const authService = new AuthService(dataSource);
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = readBearerToken(req.header("authorization"));
      const payload = token ? verifyDashboardToken(token) : null;
      if (!payload) {
        res.status(401).json({ error: { code: "unauthorized", message: "Authentication required" } });
        return;
      }
      (req as AuthenticatedRequest).user = await authService.getUserById(payload.sub);
      next();
    } catch (error) {
      next(error);
    }
  };
}
