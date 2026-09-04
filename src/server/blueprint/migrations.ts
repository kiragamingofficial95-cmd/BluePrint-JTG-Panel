import path from "path";
import fs from "fs-extra";

export interface MigrationContext {
  extensionId: string;
  dataPath: string;
  readData: <T = any>(filename: string) => Promise<T | null>;
  writeData: (filename: string, data: any) => Promise<void>;
  logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export class MigrationRunner {
  static async runExtensionMigrations(
    extensionId: string,
    extensionDir: string,
    appliedMigrations: string[],
    context: MigrationContext
  ): Promise<string[]> {
    const migrationsDir = path.join(extensionDir, "database", "migrations");
    if (!(await fs.pathExists(migrationsDir))) {
      return appliedMigrations;
    }

    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter((f) => f.endsWith(".js") || f.endsWith(".ts") || f.endsWith(".json"))
      .sort();

    const newlyApplied: string[] = [...appliedMigrations];

    for (const file of migrationFiles) {
      if (appliedMigrations.includes(file)) {
        continue;
      }

      context.logger.info(`Running migration [${file}] for extension [${extensionId}]...`);
      const filePath = path.join(migrationsDir, file);

      try {
        if (file.endsWith(".json")) {
          // Schema/Seed JSON migration
          const seedData = await fs.readJson(filePath);
          const baseName = path.basename(file, ".json");
          await context.writeData(`ext_${extensionId}_${baseName}.json`, seedData);
        } else {
          // JS/TS Migration module
          const migrationModule = await import(`file://${filePath}`);
          if (typeof migrationModule.up === "function") {
            await migrationModule.up(context);
          } else if (typeof migrationModule.default?.up === "function") {
            await migrationModule.default.up(context);
          }
        }
        newlyApplied.push(file);
        context.logger.info(`Migration [${file}] applied successfully.`);
      } catch (err: any) {
        context.logger.error(`Migration [${file}] failed: ${err.message}`);
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    return newlyApplied;
  }
}
