import path from "path";
import fs from "fs-extra";
import AdmZip from "adm-zip";
import express, { Express, Request, Response, NextFunction } from "express";
import {
  BlueprintManifest,
  BlueprintState,
  DoctorReport,
  ExtensionContext,
  IBlueprintExtension,
  InstalledExtension,
  PermissionScope,
} from "./types.js";
import { RegistryClient } from "./registryClient.js";
import { MigrationRunner } from "./migrations.js";
import { validateRequestedPermissions } from "./permissions.js";

const BLUEPRINT_VERSION = "1.0.0";
const PANEL_VERSION = "2.0.0";

export class BlueprintExtensionManager {
  private static instance: BlueprintExtensionManager;
  private stateFilePath: string;
  private extensionsDir: string;
  private state: BlueprintState;
  private app: Express | null = null;
  private registryClient: RegistryClient;
  private activeHooks: Map<string, IBlueprintExtension> = new Map();
  private dynamicRouter: express.Router = express.Router();

  private constructor() {
    const cwd = process.cwd();
    this.stateFilePath = path.join(cwd, ".data", "blueprint.json");
    this.extensionsDir = path.join(cwd, "extensions");
    this.registryClient = new RegistryClient();
    this.state = this.loadState();
  }

  public static getInstance(): BlueprintExtensionManager {
    if (!BlueprintExtensionManager.instance) {
      BlueprintExtensionManager.instance = new BlueprintExtensionManager();
    }
    return BlueprintExtensionManager.instance;
  }

  public getBlueprintVersion(): string {
    return BLUEPRINT_VERSION;
  }

  public getPanelVersion(): string {
    return PANEL_VERSION;
  }

  public getRegistryClient(): RegistryClient {
    // Re-create RegistryClient with current env var on each call to pick up runtime changes
    const currentUrl = process.env.BLUEPRINT_REGISTRY_URL || this.state.registryUrl || "https://blue-print-jtg-panel.vercel.app";
    this.registryClient.setRegistryUrl(currentUrl);
    return this.registryClient;
  }

  public getExtensionsDir(): string {
    return this.extensionsDir;
  }

  public getDynamicRouter(): express.Router {
    return this.dynamicRouter;
  }

  /**
   * Load state from .data/blueprint.json or initialize defaults
   */
  private loadState(): BlueprintState {
    fs.ensureDirSync(path.dirname(this.stateFilePath));
    fs.ensureDirSync(this.extensionsDir);

    if (fs.existsSync(this.stateFilePath)) {
      try {
        const raw = fs.readJsonSync(this.stateFilePath);
        return {
          version: BLUEPRINT_VERSION,
          registryUrl: raw.registryUrl || process.env.BLUEPRINT_REGISTRY_URL || "https://blueprint.jtgpanel.com",
          extensions: raw.extensions || {},
          configs: raw.configs || {},
          migrations: raw.migrations || {},
          auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : [],
        };
      } catch (e) {
        console.error("[Blueprint] Failed to read blueprint.json, initializing fresh state.", e);
      }
    }

    const defaultState: BlueprintState = {
      version: BLUEPRINT_VERSION,
      registryUrl: process.env.BLUEPRINT_REGISTRY_URL || "https://blue-print-jtg-panel.vercel.app",
      extensions: {},
      configs: {},
      migrations: {},
      auditLog: [],
    };
    fs.writeJsonSync(this.stateFilePath, defaultState, { spaces: 2 });
    return defaultState;
  }

  public async saveState(): Promise<void> {
    try {
      await fs.writeJson(this.stateFilePath, this.state, { spaces: 2 });
    } catch (err) {
      console.error("[Blueprint] Failed to save state to disk:", err);
    }
  }

  public logAudit(action: any["action"], extensionId: string, user = "admin", details?: Record<string, any>) {
    this.state.auditLog.unshift({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      extensionId,
      user,
      details,
    });
    // Keep max 200 audit entries
    if (this.state.auditLog.length > 200) {
      this.state.auditLog = this.state.auditLog.slice(0, 200);
    }
  }

  /**
   * Semver matching helper
   */
  public static satisfiesVersion(version: string, range: string): boolean {
    if (!range || range === "*" || range === "latest") return true;

    // Clean versions
    const parse = (v: string) => {
      const match = v.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
      if (!match) return [0, 0, 0];
      return [parseInt(match[1] || "0", 10), parseInt(match[2] || "0", 10), parseInt(match[3] || "0", 10)];
    };

    const target = parse(version);

    // Support simple range expressions like ">=2.0.0", "^1.0.0", ">=1.0.0 <2.0.0"
    const clauses = range.split(" ").filter(Boolean);
    for (const clause of clauses) {
      let op = "=";
      let verStr = clause;
      if (clause.startsWith(">=")) {
        op = ">=";
        verStr = clause.slice(2);
      } else if (clause.startsWith("<=")) {
        op = "<=";
        verStr = clause.slice(2);
      } else if (clause.startsWith(">")) {
        op = ">";
        verStr = clause.slice(1);
      } else if (clause.startsWith("<")) {
        op = "<";
        verStr = clause.slice(1);
      } else if (clause.startsWith("^")) {
        op = "^";
        verStr = clause.slice(1);
      } else if (clause.startsWith("~")) {
        op = "~";
        verStr = clause.slice(1);
      }

      const cmp = parse(verStr);
      const compare = () => {
        if (target[0] !== cmp[0]) return target[0] - cmp[0];
        if (target[1] !== cmp[1]) return target[1] - cmp[1];
        return target[2] - cmp[2];
      };

      const diff = compare();

      if (op === ">=" && diff < 0) return false;
      if (op === ">" && diff <= 0) return false;
      if (op === "<=" && diff > 0) return false;
      if (op === "<" && diff >= 0) return false;
      if (op === "=" && diff !== 0) return false;
      if (op === "^") {
        // Same major
        if (target[0] !== cmp[0] || diff < 0) return false;
      }
      if (op === "~") {
        // Same major and minor
        if (target[0] !== cmp[0] || target[1] !== cmp[1] || diff < 0) return false;
      }
    }

    return true;
  }

  /**
   * Validate manifest integrity and structure
   */
  public validateManifest(manifest: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest || typeof manifest !== "object") {
      return { valid: false, errors: ["Manifest must be a valid JSON object."] };
    }

    if (!manifest.id || typeof manifest.id !== "string" || !/^[a-z0-9-_]+$/.test(manifest.id)) {
      errors.push("Invalid extension id. Must be lowercase alphanumeric with hyphens/underscores.");
    }

    if (manifest.id && (manifest.id.includes("..") || manifest.id.includes("/") || manifest.id.includes("\\"))) {
      errors.push("Path traversal characters not allowed in extension id.");
    }

    if (!manifest.name || typeof manifest.name !== "string" || manifest.name.trim().length === 0) {
      errors.push("Extension name is required.");
    }

    if (!manifest.version || typeof manifest.version !== "string") {
      errors.push("Extension version is required.");
    }

    if (!manifest.compatibility || typeof manifest.compatibility !== "object") {
      errors.push("Extension compatibility declaration is required.");
    } else {
      if (
        manifest.compatibility.jtg_panel &&
        !BlueprintExtensionManager.satisfiesVersion(PANEL_VERSION, manifest.compatibility.jtg_panel)
      ) {
        errors.push(
          `Incompatible with JTG Panel version (Current: ${PANEL_VERSION}, Requires: ${manifest.compatibility.jtg_panel})`
        );
      }
      if (
        manifest.compatibility.blueprint &&
        !BlueprintExtensionManager.satisfiesVersion(BLUEPRINT_VERSION, manifest.compatibility.blueprint)
      ) {
        errors.push(
          `Incompatible with JTG Blueprint version (Current: ${BLUEPRINT_VERSION}, Requires: ${manifest.compatibility.blueprint})`
        );
      }
    }

    if (manifest.permissions && Array.isArray(manifest.permissions)) {
      const permValidation = validateRequestedPermissions(manifest.permissions);
      if (!permValidation.valid) {
        errors.push(...permValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create context for extension runtime
   */
  private createContext(extensionId: string): ExtensionContext {
    const installed = this.state.extensions[extensionId];
    const dataDir = path.join(process.cwd(), ".data", "ext_data", extensionId);
    fs.ensureDirSync(dataDir);

    const config = this.state.configs[extensionId] || {};

    return {
      extensionId,
      version: installed?.manifest.version || "1.0.0",
      config,
      permissions: installed?.grantedPermissions || [],
      dataPath: dataDir,
      logger: {
        info: (msg: string, ...args: any[]) => console.log(`[Blueprint:${extensionId}] [INFO]`, msg, ...args),
        warn: (msg: string, ...args: any[]) => console.warn(`[Blueprint:${extensionId}] [WARN]`, msg, ...args),
        error: (msg: string, ...args: any[]) => console.error(`[Blueprint:${extensionId}] [ERROR]`, msg, ...args),
      },
      getConfig: <T = any>(key: string, defaultValue?: T): T => {
        return (config[key] !== undefined ? config[key] : defaultValue) as T;
      },
      setConfig: async (key: string, value: any) => {
        if (!this.state.configs[extensionId]) {
          this.state.configs[extensionId] = {};
        }
        this.state.configs[extensionId][key] = value;
        await this.saveState();
      },
      db: {
        get: async (collection: string, query?: Record<string, any>) => {
          const sanitized = collection.replace(/[^a-zA-Z0-9_-]/g, "");
          const file = path.join(dataDir, `${sanitized}.json`);
          if (!(await fs.pathExists(file))) return [];
          try {
            const data = await fs.readJson(file);
            if (!Array.isArray(data)) return [];
            if (!query) return data;
            return data.filter((item) =>
              Object.entries(query).every(([k, v]) => item[k] === v)
            );
          } catch {
            return [];
          }
        },
        set: async (collection: string, id: string, doc: any) => {
          const sanitized = collection.replace(/[^a-zA-Z0-9_-]/g, "");
          const file = path.join(dataDir, `${sanitized}.json`);
          let data: any[] = [];
          if (await fs.pathExists(file)) {
            try {
              data = await fs.readJson(file);
            } catch {
              data = [];
            }
          }
          const index = data.findIndex((d) => d.id === id);
          const record = { ...doc, id, updatedAt: new Date().toISOString() };
          if (index >= 0) {
            data[index] = record;
          } else {
            data.push({ ...record, createdAt: new Date().toISOString() });
          }
          await fs.writeJson(file, data, { spaces: 2 });
        },
        remove: async (collection: string, id: string) => {
          const sanitized = collection.replace(/[^a-zA-Z0-9_-]/g, "");
          const file = path.join(dataDir, `${sanitized}.json`);
          if (!(await fs.pathExists(file))) return;
          try {
            let data = await fs.readJson(file);
            if (Array.isArray(data)) {
              data = data.filter((d) => d.id !== id);
              await fs.writeJson(file, data, { spaces: 2 });
            }
          } catch {}
        },
      },
    };
  }

  /**
   * Discover and mount installed extensions on startup
   */
  public async init(app?: Express): Promise<void> {
    if (app) {
      this.app = app;
      this.app.use(this.dynamicRouter);
    }

    console.log(`[Blueprint] Initializing JTG Blueprint Framework v${BLUEPRINT_VERSION}...`);
    await this.discoverAndSync();

    // Mount all enabled extensions
    for (const [id, ext] of Object.entries(this.state.extensions)) {
      if (ext.enabled) {
        try {
          await this.mountExtension(id);
        } catch (err: any) {
          console.error(`[Blueprint] Error mounting extension ${id}:`, err.message);
          ext.status = "error";
          ext.errorMessage = err.message;
        }
      }
    }

    await this.saveState();
    console.log(
      `[Blueprint] Framework initialized with ${Object.keys(this.state.extensions).length} extensions registered.`
    );
  }

  /**
   * Discover local extension folders and sync state
   */
  public async discoverAndSync(): Promise<InstalledExtension[]> {
    fs.ensureDirSync(this.extensionsDir);
    const entries = await fs.readdir(this.extensionsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const extDir = path.join(this.extensionsDir, entry.name);
      const manifestFile = (await fs.pathExists(path.join(extDir, "blueprint.json")))
        ? path.join(extDir, "blueprint.json")
        : (await fs.pathExists(path.join(extDir, "manifest.json")))
        ? path.join(extDir, "manifest.json")
        : null;

      if (!manifestFile) continue;

      try {
        const manifest: BlueprintManifest = await fs.readJson(manifestFile);
        const val = this.validateManifest(manifest);

        if (!this.state.extensions[manifest.id]) {
          this.state.extensions[manifest.id] = {
            manifest,
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            enabled: val.valid,
            status: val.valid ? "active" : "error",
            errorMessage: val.errors.join(", "),
            localPath: extDir,
            grantedPermissions: manifest.permissions || [],
          };
          this.logAudit("install", manifest.id, "system", { source: "local_discovery" });
        } else {
          // Update manifest cache
          this.state.extensions[manifest.id].manifest = manifest;
          this.state.extensions[manifest.id].localPath = extDir;
          if (!val.valid) {
            this.state.extensions[manifest.id].status = "error";
            this.state.extensions[manifest.id].errorMessage = val.errors.join(", ");
          }
        }
      } catch (err: any) {
        console.warn(`[Blueprint] Could not parse manifest in ${extDir}:`, err.message);
      }
    }

    await this.saveState();
    return Object.values(this.state.extensions);
  }

  /**
   * Mount backend entrypoints, routes, and hooks for an extension
   */
  private async mountExtension(extensionId: string): Promise<void> {
    const ext = this.state.extensions[extensionId];
    if (!ext) throw new Error(`Extension ${extensionId} not found.`);

    const backendPath = ext.manifest.entrypoints?.backend
      ? path.join(ext.localPath, ext.manifest.entrypoints.backend)
      : null;

    const context = this.createContext(extensionId);

    if (backendPath && (await fs.pathExists(backendPath))) {
      try {
        const mod = await import(`file://${backendPath}?t=${Date.now()}`);
        const handler: IBlueprintExtension = mod.default || mod;
        this.activeHooks.set(extensionId, handler);

        // Execute enable lifecycle hook
        if (typeof handler.enable === "function") {
          await handler.enable(context);
        }

        // Register custom router if exported
        if (mod.router || mod.routes || (handler as any).router) {
          const extensionRouter = mod.router || mod.routes || (handler as any).router;
          const routePrefix = ext.manifest.routes?.apiPrefix || `/api/extensions/${extensionId}`;

          // Create an isolated sub-router
          const safeWrapperRouter = express.Router();
          safeWrapperRouter.use((req: Request, res: Response, next: NextFunction) => {
            // Permission check or safety wrapper
            try {
              next();
            } catch (routeErr: any) {
              context.logger.error("Route error:", routeErr);
              res.status(500).json({ error: "Extension internal route error.", details: routeErr.message });
            }
          });
          safeWrapperRouter.use(extensionRouter);

          this.dynamicRouter.use(routePrefix, safeWrapperRouter);
        }

        ext.status = "active";
        ext.errorMessage = undefined;
      } catch (err: any) {
        context.logger.error(`Failed to load backend module for ${extensionId}:`, err);
        ext.status = "error";
        ext.errorMessage = `Backend load failure: ${err.message}`;
        throw err;
      }
    } else {
      ext.status = "active";
    }
  }

  /**
   * Unmount an extension from memory and call disable hook
   */
  private async unmountExtension(extensionId: string): Promise<void> {
    const handler = this.activeHooks.get(extensionId);
    const context = this.createContext(extensionId);

    if (handler && typeof handler.disable === "function") {
      try {
        await handler.disable(context);
      } catch (err: any) {
        context.logger.error(`Error during disable hook for ${extensionId}:`, err);
      }
    }

    this.activeHooks.delete(extensionId);
  }

  /**
   * Install extension from a zip package buffer or file
   */
  public async installFromZip(
    zipBufferOrPath: Buffer | string,
    grantedPermissions?: PermissionScope[]
  ): Promise<InstalledExtension> {
    let zip: AdmZip;
    if (Buffer.isBuffer(zipBufferOrPath)) {
      zip = new AdmZip(zipBufferOrPath);
    } else {
      zip = new AdmZip(zipBufferOrPath);
    }

    // Find manifest in zip
    let manifestEntry: any = zip.getEntry("blueprint.json") || zip.getEntry("manifest.json");
    if (!manifestEntry) {
      // Check if nested in root folder
      const entries = zip.getEntries();
      manifestEntry = entries.find(
        (e) => !e.isDirectory && (e.entryName.endsWith("/blueprint.json") || e.entryName.endsWith("/manifest.json"))
      );
    }

    if (!manifestEntry) {
      throw new Error("Invalid extension archive: blueprint.json or manifest.json not found in package.");
    }

    const manifestText = manifestEntry.getData().toString("utf8");
    let manifest: BlueprintManifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      throw new Error("Corrupted blueprint.json in package archive.");
    }

    const val = this.validateManifest(manifest);
    if (!val.valid) {
      throw new Error(`Invalid extension package: ${val.errors.join("; ")}`);
    }

    // Check directory traversal in archive
    for (const entry of zip.getEntries()) {
      if (entry.entryName.includes("..") || path.isAbsolute(entry.entryName)) {
        throw new Error("Malicious extension archive detected: Path traversal entry found.");
      }
    }

    const targetDir = path.join(this.extensionsDir, manifest.id);

    // If already exists, backup before extracting
    const backupDir = path.join(process.cwd(), ".data", "temp", `backup_${manifest.id}_${Date.now()}`);
    if (await fs.pathExists(targetDir)) {
      await fs.copy(targetDir, backupDir);
    }

    try {
      await fs.ensureDir(targetDir);
      zip.extractAllTo(targetDir, true);

      // Run migrations
      const context = this.createContext(manifest.id);
      const appliedMigrations = this.state.migrations[manifest.id] || [];
      const updatedMigrations = await MigrationRunner.runExtensionMigrations(
        manifest.id,
        targetDir,
        appliedMigrations,
        {
          extensionId: manifest.id,
          dataPath: context.dataPath,
          readData: async (file: string) => {
            const fp = path.join(context.dataPath, file);
            return (await fs.pathExists(fp)) ? await fs.readJson(fp) : null;
          },
          writeData: async (file: string, data: any) => {
            const fp = path.join(context.dataPath, file);
            await fs.writeJson(fp, data, { spaces: 2 });
          },
          logger: context.logger,
        }
      );
      this.state.migrations[manifest.id] = updatedMigrations;

      // Initialize default config if schema provided
      if (manifest.configSchema?.fields) {
        if (!this.state.configs[manifest.id]) {
          this.state.configs[manifest.id] = {};
        }
        for (const field of manifest.configSchema.fields) {
          if (this.state.configs[manifest.id][field.key] === undefined && field.default !== undefined) {
            this.state.configs[manifest.id][field.key] = field.default;
          }
        }
      }

      const installed: InstalledExtension = {
        manifest,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        enabled: true,
        status: "active",
        localPath: targetDir,
        grantedPermissions: grantedPermissions || manifest.permissions || [],
      };

      this.state.extensions[manifest.id] = installed;
      this.logAudit("install", manifest.id, "admin", { version: manifest.version });
      await this.saveState();

      // Mount and run install hook
      await this.mountExtension(manifest.id);
      const hook = this.activeHooks.get(manifest.id);
      if (hook && typeof hook.install === "function") {
        await hook.install(context);
      }

      // Cleanup backup on success
      if (await fs.pathExists(backupDir)) {
        await fs.remove(backupDir);
      }

      return installed;
    } catch (err: any) {
      // Rollback if backup existed
      if (await fs.pathExists(backupDir)) {
        await fs.remove(targetDir);
        await fs.copy(backupDir, targetDir);
        await fs.remove(backupDir);
      }
      throw new Error(`Failed to install extension: ${err.message}`);
    }
  }

  /**
   * Install extension using Registry Extension Key
   */
  public async installWithKey(key: string, userGrantedPermissions?: PermissionScope[]): Promise<InstalledExtension> {
    const preview = await this.registryClient.validateKey(key);
    if (!preview.valid || !preview.extensionId) {
      throw new Error(preview.error || "Invalid extension key.");
    }

    const tempPackagePath = path.join(
      process.cwd(),
      ".data",
      "temp",
      `pkg_${preview.extensionId}_${Date.now()}.zip`
    );

    try {
      const { checksum } = await this.registryClient.downloadPackage(key, tempPackagePath);

      if (preview.checksum && !RegistryClient.verifyChecksum(tempPackagePath, preview.checksum)) {
        throw new Error("Package integrity check failed: SHA256 checksum mismatch.");
      }

      const installed = await this.installFromZip(
        tempPackagePath,
        userGrantedPermissions || (preview.permissions as PermissionScope[])
      );
      installed.checksum = checksum;
      await this.saveState();

      return installed;
    } finally {
      if (await fs.pathExists(tempPackagePath)) {
        await fs.remove(tempPackagePath);
      }
    }
  }

  /**
   * Enable extension
   */
  public async enableExtension(extensionId: string): Promise<InstalledExtension> {
    const ext = this.state.extensions[extensionId];
    if (!ext) throw new Error(`Extension ${extensionId} not found.`);

    ext.enabled = true;
    await this.mountExtension(extensionId);
    ext.status = "active";
    this.logAudit("enable", extensionId);
    await this.saveState();
    return ext;
  }

  /**
   * Disable extension
   */
  public async disableExtension(extensionId: string): Promise<InstalledExtension> {
    const ext = this.state.extensions[extensionId];
    if (!ext) throw new Error(`Extension ${extensionId} not found.`);

    await this.unmountExtension(extensionId);
    ext.enabled = false;
    ext.status = "disabled";
    this.logAudit("disable", extensionId);
    await this.saveState();
    return ext;
  }

  /**
   * Update extension
   */
  public async updateExtension(
    extensionId: string,
    zipBufferOrPath: Buffer | string
  ): Promise<InstalledExtension> {
    const existing = this.state.extensions[extensionId];
    if (!existing) throw new Error(`Extension ${extensionId} is not installed.`);

    const fromVersion = existing.manifest.version;
    await this.unmountExtension(extensionId);

    const updated = await this.installFromZip(zipBufferOrPath, existing.grantedPermissions);
    const toVersion = updated.manifest.version;

    const hook = this.activeHooks.get(extensionId);
    const context = this.createContext(extensionId);
    if (hook && typeof hook.update === "function") {
      await hook.update(fromVersion, toVersion, context);
    }

    this.logAudit("update", extensionId, "admin", { fromVersion, toVersion });
    await this.saveState();
    return updated;
  }

  /**
   * Uninstall extension
   */
  public async uninstallExtension(extensionId: string, purgeData = false): Promise<void> {
    const ext = this.state.extensions[extensionId];
    if (!ext) throw new Error(`Extension ${extensionId} not found.`);

    const hook = this.activeHooks.get(extensionId);
    const context = this.createContext(extensionId);

    if (hook && typeof hook.uninstall === "function") {
      try {
        await hook.uninstall(context, purgeData);
      } catch (e) {
        console.error(`Error in extension ${extensionId} uninstall hook:`, e);
      }
    }

    await this.unmountExtension(extensionId);

    // Delete folder
    if (await fs.pathExists(ext.localPath)) {
      await fs.remove(ext.localPath);
    }

    // Optionally purge configuration and scoped database
    if (purgeData) {
      delete this.state.configs[extensionId];
      delete this.state.migrations[extensionId];
      const dataDir = path.join(process.cwd(), ".data", "ext_data", extensionId);
      if (await fs.pathExists(dataDir)) {
        await fs.remove(dataDir);
      }
    }

    delete this.state.extensions[extensionId];
    this.logAudit("uninstall", extensionId, "admin", { purgeData });
    await this.saveState();
  }

  /**
   * Get all installed extensions with framework metadata
   */
  public getExtensions(): InstalledExtension[] {
    return Object.values(this.state.extensions);
  }

  /**
   * Get single extension
   */
  public getExtension(id: string): InstalledExtension | null {
    return this.state.extensions[id] || null;
  }

  /**
   * Get extension configuration
   */
  public getExtensionConfiguration(id: string): { schema?: any; config: Record<string, any> } {
    const ext = this.state.extensions[id];
    if (!ext) throw new Error(`Extension ${id} not found.`);
    return {
      schema: ext.manifest.configSchema,
      config: this.state.configs[id] || {},
    };
  }

  /**
   * Update extension configuration
   */
  public async setExtensionConfiguration(id: string, newConfig: Record<string, any>): Promise<Record<string, any>> {
    const ext = this.state.extensions[id];
    if (!ext) throw new Error(`Extension ${id} not found.`);

    // Schema validation if defined
    if (ext.manifest.configSchema?.fields) {
      for (const field of ext.manifest.configSchema.fields) {
        const val = newConfig[field.key];
        if (field.required && (val === undefined || val === null || val === "")) {
          throw new Error(`Configuration field '${field.label}' is required.`);
        }
        if (field.type === "number" && val !== undefined) {
          const num = Number(val);
          if (isNaN(num)) throw new Error(`Field '${field.label}' must be a number.`);
          if (field.min !== undefined && num < field.min)
            throw new Error(`Field '${field.label}' cannot be less than ${field.min}.`);
          if (field.max !== undefined && num > field.max)
            throw new Error(`Field '${field.label}' cannot exceed ${field.max}.`);
          newConfig[field.key] = num;
        }
      }
    }

    this.state.configs[id] = { ...this.state.configs[id], ...newConfig };
    this.logAudit("configure", id, "admin");
    await this.saveState();
    return this.state.configs[id];
  }

  /**
   * Doctor / Health diagnostics
   */
  public async runDoctor(): Promise<DoctorReport> {
    const issues: DoctorReport["issues"] = [];
    const exts = Object.values(this.state.extensions);

    for (const ext of exts) {
      // Check manifest validity
      const val = this.validateManifest(ext.manifest);
      if (!val.valid) {
        issues.push({
          type: "error",
          extensionId: ext.manifest.id,
          message: `Manifest validation errors: ${val.errors.join(", ")}`,
          resolution: "Reinstall extension or correct blueprint.json.",
        });
      }

      // Check directory existence
      if (!(await fs.pathExists(ext.localPath))) {
        issues.push({
          type: "error",
          extensionId: ext.manifest.id,
          message: `Extension directory missing: ${ext.localPath}`,
          resolution: "Run 'jtg blueprint uninstall <id>' or restore files.",
        });
      }

      // Check backend entrypoint
      if (ext.manifest.entrypoints?.backend) {
        const ep = path.join(ext.localPath, ext.manifest.entrypoints.backend);
        if (!(await fs.pathExists(ep))) {
          issues.push({
            type: "warning",
            extensionId: ext.manifest.id,
            message: `Declared backend entrypoint missing: ${ext.manifest.entrypoints.backend}`,
          });
        }
      }
    }

    const hasErrors = issues.some((i) => i.type === "error");
    const hasWarnings = issues.some((i) => i.type === "warning");

    return {
      overallStatus: hasErrors ? "critical" : hasWarnings ? "warnings" : "healthy",
      frameworkVersion: BLUEPRINT_VERSION,
      panelVersion: PANEL_VERSION,
      activeExtensionsCount: exts.filter((e) => e.enabled && e.status === "active").length,
      totalExtensionsCount: exts.length,
      issues,
    };
  }
}
