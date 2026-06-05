import type { NextFunction, Response } from "express";
import type { DataSource } from "typeorm";
import { TeamService, type TeamRole } from "../services/team.service.js";
import type { AuthenticatedRequest } from "./dashboard-auth.js";

export function requireTeamRole(dataSource: DataSource, minimumRole: TeamRole) {
  const teamService = new TeamService(dataSource);
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      await teamService.requireRole(req.user.id, String(req.params.teamId ?? ""), minimumRole);
      next();
    } catch (error) {
      next(error);
    }
  };
}
