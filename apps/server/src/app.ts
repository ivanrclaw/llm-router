import "reflect-metadata";
import cors from "cors";
import express, { type Express } from "express";
import type { DataSource } from "typeorm";
import { AppDataSource } from "./data-source.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createApiKeyRouter } from "./routes/api-key.routes.js";
import { healthRouter } from "./routes/health.js";
import { createInvitationRouter } from "./routes/invitation.routes.js";
import { createTeamRouter } from "./routes/team.routes.js";
import { createOpenAiCompatibleRouter } from "./routes/openai-compatible.routes.js";
import { createProviderKeyRouter } from "./routes/provider-key.routes.js";
import { createModelGroupRouter } from "./routes/model-group.routes.js";
import { createModelRouter } from "./routes/model.routes.js";

export type AppDependencies = {
  dataSource?: DataSource;
};

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  const dataSource = dependencies.dataSource ?? AppDataSource;

  app.use(cors());
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api/auth", createAuthRouter(dataSource));
  app.use("/api/teams/:teamId/api-keys", createApiKeyRouter(dataSource));
  app.use("/api/teams/:teamId/provider-keys", createProviderKeyRouter(dataSource));
  app.use("/api/teams/:teamId/model-groups", createModelGroupRouter(dataSource));
  app.use("/api/teams", createTeamRouter(dataSource));
  app.use("/api/invitations", createInvitationRouter(dataSource));
  app.use("/api/models", createModelRouter(dataSource));
  app.use("/v1", createOpenAiCompatibleRouter(dataSource));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
