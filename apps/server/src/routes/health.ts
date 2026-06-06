import { Router, type Request, type Response } from "express";
import type { DataSource } from "typeorm";

export const healthRouter: Router = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "llm-router",
    version: "0.0.0",
  });
});

export function createReadyRouter(dataSource: DataSource): Router {
  const router = Router();

  router.get("/ready", async (_req: Request, res: Response) => {
    const basePayload = {
      service: "llm-router",
      timestamp: new Date().toISOString(),
      version: "0.0.0",
    };

    if (!dataSource.isInitialized) {
      res.status(503).json({
        ...basePayload,
        status: "not_ready",
        database: { connected: false },
      });
      return;
    }

    try {
      const migrationsPending = await dataSource.showMigrations();
      await dataSource.query("SELECT 1");
      res.json({
        ...basePayload,
        status: "ready",
        database: { connected: true, migrationsPending },
      });
    } catch (error) {
      res.status(503).json({
        ...basePayload,
        status: "not_ready",
        database: { connected: dataSource.isInitialized },
      });
    }
  });

  return router;
}
