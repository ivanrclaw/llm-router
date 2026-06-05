import { AppDataSource } from "../data-source.js";
import { ModelCatalogService } from "../services/model-catalog.service.js";

await AppDataSource.initialize();
await AppDataSource.runMigrations();
const sync = await new ModelCatalogService(AppDataSource).syncOpenCodeZenModels();
console.log(JSON.stringify(sync));
await AppDataSource.destroy();
