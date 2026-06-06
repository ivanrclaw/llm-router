import "reflect-metadata";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import type { DataSource } from "typeorm";
import { AppDataSource } from "./data-source.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authRateLimit, v1RateLimit } from "./middleware/rate-limit.js";
import { configuredCors, securityHeaders } from "./middleware/security.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createApiKeyRouter } from "./routes/api-key.routes.js";
import { createReadyRouter, healthRouter } from "./routes/health.js";
import { createInvitationRouter } from "./routes/invitation.routes.js";
import { createTeamRouter } from "./routes/team.routes.js";
import { createOpenAiCompatibleRouter } from "./routes/openai-compatible.routes.js";
import { createProviderKeyRouter } from "./routes/provider-key.routes.js";
import { createModelGroupRouter } from "./routes/model-group.routes.js";
import { createModelRouter } from "./routes/model.routes.js";
import { createBudgetRouter } from "./routes/budget.routes.js";
import { createStatsRouter } from "./routes/stats.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultWebDistPath = path.resolve(__dirname, "web");

export type AppDependencies = {
  dataSource?: DataSource;
};

function shouldServeWebDist(): boolean {
  return process.env.SERVE_WEB_DIST === "true" || process.env.NODE_ENV === "production";
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  const dataSource = dependencies.dataSource ?? AppDataSource;

  app.use(securityHeaders);
  app.use(configuredCors());
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api", createReadyRouter(dataSource));
  app.use("/api/auth", authRateLimit(), createAuthRouter(dataSource));
  app.use("/api/teams/:teamId/api-keys", createApiKeyRouter(dataSource));
  app.use("/api/teams/:teamId/provider-keys", createProviderKeyRouter(dataSource));
  app.use("/api/teams/:teamId/model-groups", createModelGroupRouter(dataSource));
  app.use("/api/teams/:teamId/budgets", createBudgetRouter(dataSource));
  app.use("/api/teams/:teamId/stats", createStatsRouter(dataSource));
  app.use("/api/teams", createTeamRouter(dataSource));
  app.use("/api/invitations", createInvitationRouter(dataSource));
  app.use("/api/models", createModelRouter(dataSource));
  app.use("/v1", v1RateLimit(), createOpenAiCompatibleRouter(dataSource));

  const webDistPath = process.env.WEB_DIST_PATH ?? defaultWebDistPath;
  if (shouldServeWebDist() && fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath, { index: false }));
    app.get(/^\/(?!api\/|v1\/).*/, (_req, res) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
