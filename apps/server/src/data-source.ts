import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";
import { fileURLToPath } from "url";
import {
  AuditLog,
  BudgetLedger,
  BudgetPolicy,
  Invitation,
  ModelGroup,
  ModelGroupCandidate,
  ModelPricing,
  PlatformApiKey,
  Provider,
  ProviderApiKey,
  ProviderModel,
  SessionAffinity,
  SystemSetting,
  Team,
  TeamMember,
  UsageDailyAggregate,
  UsageEvent,
  User,
} from "./entities/index.js";
import { InitialSchema1780689600000 } from "./migrations/1780689600000-InitialSchema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isTest = process.env.NODE_ENV === "test";

export const entities = [
  AuditLog,
  BudgetLedger,
  BudgetPolicy,
  Invitation,
  ModelGroup,
  ModelGroupCandidate,
  ModelPricing,
  PlatformApiKey,
  Provider,
  ProviderApiKey,
  ProviderModel,
  SessionAffinity,
  SystemSetting,
  Team,
  TeamMember,
  UsageDailyAggregate,
  UsageEvent,
  User,
];

export const migrations = [InitialSchema1780689600000];

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database:
    process.env.DATABASE_PATH ?? path.join(__dirname, "..", "data", "llm-router.sqlite"),
  synchronize: false,
  logging: process.env.NODE_ENV !== "production" && !isTest,
  entities,
  migrations,
});
