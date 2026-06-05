import express, { type Router } from "express";

export const healthRouter: Router = express.Router();

healthRouter.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "llm-router",
    version: "0.0.0",
  });
});
