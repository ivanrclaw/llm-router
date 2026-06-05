import { Router, type Request, type Response } from "express";

export const healthRouter: Router = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "llm-router",
    version: "0.0.0",
  });
});
