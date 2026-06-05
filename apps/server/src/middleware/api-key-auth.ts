import type { NextFunction, Request, Response } from "express";
import type { DataSource } from "typeorm";
import { readBearerToken } from "../lib/token.js";
import { ApiKeyService } from "../services/api-key.service.js";

export type ApiKeyAuthenticatedRequest = Request & {
  platformApiKey: {
    id: string;
    teamId: string;
    userId: string;
    scopesJson: string;
  };
};

export function apiKeyAuth(dataSource: DataSource, requiredScope: string) {
  const apiKeyService = new ApiKeyService(dataSource);
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = readBearerToken(req.header("authorization"));
      if (!token) {
        res.status(401).json({ error: { code: "missing_api_key", message: "Missing API key" } });
        return;
      }
      (req as ApiKeyAuthenticatedRequest).platformApiKey = await apiKeyService.authenticate(token, requiredScope);
      next();
    } catch (error) {
      next(error);
    }
  };
}
