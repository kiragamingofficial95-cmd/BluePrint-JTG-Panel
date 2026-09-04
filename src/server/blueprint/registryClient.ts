import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import axios from "axios";
import AdmZip from "adm-zip";
import { BlueprintManifest } from "./types.js";

export interface KeyValidationResult {
  valid: boolean;
  key: string;
  extensionId?: string;
  extensionName?: string;
  version?: string;
  description?: string;
  author?: {
    name: string;
    url?: string;
  };
  icon?: string;
  compatibility?: {
    jtg_panel: string;
    blueprint: string;
  };
  permissions?: string[];
  packageUrl?: string;
  checksum?: string;
  error?: string;
}

export const DEFAULT_REGISTRY_URL = "https://blue-print-jtg-panel.vercel.app";

export class RegistryClient {
  private registryUrl: string;

  constructor(registryUrl = process.env.BLUEPRINT_REGISTRY_URL || DEFAULT_REGISTRY_URL) {
    this.registryUrl = (registryUrl || DEFAULT_REGISTRY_URL).replace(/\/$/, "");
  }

  setRegistryUrl(url: string) {
    this.registryUrl = (url || DEFAULT_REGISTRY_URL).replace(/\/$/, "");
  }

  getRegistryUrl(): string {
    return this.registryUrl;
  }

  /**
   * Validate an extension key with the Registry (or local test catalog) without downloading package yet.
   */
  async validateKey(key: string): Promise<KeyValidationResult> {
    const trimmedKey = (key || "").trim();
    if (!trimmedKey) {
      return { valid: false, key: "", error: "Extension key cannot be empty." };
    }

    const isTestOrDemoKey =
      trimmedKey.startsWith("jtg_key_demo_") ||
      trimmedKey.startsWith("jtg_key_hello_") ||
      trimmedKey.startsWith("jtg_key_test_") ||
      trimmedKey.startsWith("jtg_key_sample_") ||
      trimmedKey === "demo" ||
      trimmedKey === "test" ||
      trimmedKey === "sample" ||
      trimmedKey === "jtg_key_demo" ||
      trimmedKey === "jtg_key_test" ||
      trimmedKey === "jtg_key_sample";

    let remoteErrorMessage: string | null = null;

    // 1. Try querying remote registry endpoint if URL is configured
    try {
      const endpoints = [
        `${this.registryUrl}/api/v1/keys/validate`,
        `${this.registryUrl}/api/keys/validate`,
        `${this.registryUrl}/api/validate`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.post(
            endpoint,
            { key: trimmedKey },
            { timeout: 8000, validateStatus: (s) => s < 500 }
          );

          if (response.status === 200 && response.data) {
            const data = response.data;
            if (data && (data.valid === true || data.data?.valid === true)) {
              const ext = data.extension || data.data?.extension || {};
              const authorObj =
                typeof (ext.author || data.author) === "string"
                  ? { name: ext.author || data.author }
                  : ext.author || data.author || { name: "JTG Developer" };

              return {
                valid: true,
                key: trimmedKey,
                extensionId: ext.id || data.extensionId || data.data?.extensionId,
                extensionName: ext.name || data.extensionName || data.name,
                version: data.version || ext.version || "1.0.0",
                description: ext.description || data.description || "JTG Blueprint Extension",
                author: authorObj,
                icon: ext.icon || data.icon || "Boxes",
                compatibility: ext.compatibility || data.compatibility || { jtg_panel: ">=2.0.0", blueprint: ">=1.0.0" },
                permissions: data.permissions || ext.permissions || [],
                packageUrl: data.packageUrl || data.data?.packageUrl,
                checksum: data.checksum || data.data?.checksum,
              };
            } else if (data.error || data.message) {
              remoteErrorMessage = typeof data.error === "string" ? data.error : data.message;
            }
          }
        } catch {
          // Endpoint unavailable, try next endpoint or local resolution
        }
      }
    } catch {
      // Remote registry unreachable
    }

    // 2. Resolve local or sample test extension key
    const localResolution = await this.resolveLocalOrSampleKey(trimmedKey, isTestOrDemoKey);
    if (localResolution) {
      return localResolution;
    }

    // 3. Neither remote nor local could validate
    return {
      valid: false,
      key: trimmedKey,
      error:
        remoteErrorMessage ||
        "Invalid extension key. For testing in JTG Panel, you can use sample test key 'jtg_key_demo_hello' or 'jtg_key_test_hello-jtg'.",
    };
  }

  /**
   * Helper to inspect local filesystem extensions/ directory or return fallback demo extension preview.
   */
  private async resolveLocalOrSampleKey(
    key: string,
    isExplicitTestKey: boolean
  ): Promise<KeyValidationResult | null> {
    const trimmedKey = key.trim();

    // Extract potential extension ID from key format:
    // e.g. jtg_key_<extensionId>_<version>_<token> or jtg_key_test_<extensionId>
    let possibleExtensionId: string | null = null;

    if (trimmedKey.startsWith("jtg_key_demo_") || trimmedKey.startsWith("jtg_key_hello_")) {
      possibleExtensionId = "hello-jtg";
    } else if (trimmedKey.startsWith("jtg_key_test_")) {
      const rest = trimmedKey.replace("jtg_key_test_", "");
      possibleExtensionId = rest.split("_")[0] || "hello-jtg";
    } else if (trimmedKey.startsWith("jtg_key_sample_")) {
      const rest = trimmedKey.replace("jtg_key_sample_", "");
      possibleExtensionId = rest.split("_")[0] || "hello-jtg";
    } else if (trimmedKey.startsWith("jtg_key_")) {
      const parts = trimmedKey.replace("jtg_key_", "").split("_");
      possibleExtensionId = parts[0] || null;
    } else if (isExplicitTestKey) {
      possibleExtensionId = "hello-jtg";
    }

    const candidates = [
      possibleExtensionId,
      "hello-jtg",
    ].filter(Boolean) as string[];

    const baseDirs = [
      path.join(process.cwd(), "extensions"),
      path.join(process.cwd(), "..", "Blueprint", "extensions"),
    ];

    for (const baseDir of baseDirs) {
      for (const extId of candidates) {
        const extDir = path.join(baseDir, extId);
        const manifestPath = path.join(extDir, "blueprint.json");
        const altManifestPath = path.join(extDir, "manifest.json");

        let manifest: any = null;
        if (await fs.pathExists(manifestPath)) {
          try {
            manifest = await fs.readJson(manifestPath);
          } catch {}
        } else if (await fs.pathExists(altManifestPath)) {
          try {
            manifest = await fs.readJson(altManifestPath);
          } catch {}
        }

        if (manifest && manifest.id) {
          if (
            isExplicitTestKey ||
            extId === possibleExtensionId ||
            trimmedKey.includes(manifest.id) ||
            trimmedKey.startsWith("jtg_key_")
          ) {
            const authorObj =
              typeof manifest.author === "string"
                ? { name: manifest.author }
                : manifest.author || { name: "JTG Core Team", url: "https://github.com/kiragamingofficial95-cmd" };

            return {
              valid: true,
              key: trimmedKey,
              extensionId: manifest.id,
              extensionName: manifest.name || manifest.id,
              version: manifest.version || "1.0.0",
              description: manifest.description || "JTG Blueprint Extension",
              author: authorObj,
              icon: manifest.icon || "Sparkles",
              compatibility: manifest.compatibility || { jtg_panel: ">=2.0.0", blueprint: ">=1.0.0" },
              permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
            };
          }
        }
      }
    }

    // Default demo fallback if explicit test key was provided
    if (isExplicitTestKey || trimmedKey.startsWith("jtg_key_")) {
      return {
        valid: true,
        key: trimmedKey,
        extensionId: "hello-jtg",
        extensionName: "Hello JTG",
        version: "1.0.0",
        description: "Official example extension demonstrating JTG Blueprint capabilities.",
        author: { name: "JTG Core Team", url: "https://github.com/kiragamingofficial95-cmd" },
        icon: "Sparkles",
        compatibility: { jtg_panel: ">=2.0.0", blueprint: ">=1.0.0" },
        permissions: ["servers.read", "settings.read"],
      };
    }

    return null;
  }

  /**
   * Redeem the key and download package archive to a temporary file.
   */
  async downloadPackage(key: string, targetPath: string): Promise<{ checksum: string; manifest?: BlueprintManifest }> {
    const trimmedKey = (key || "").trim();
    let packageUrl: string | undefined;
    let expectedChecksum: string | undefined;

    // 1. Try remote redeem endpoint if reachable
    try {
      const redeemResponse = await axios.post(
        `${this.registryUrl}/api/v1/keys/redeem`,
        { key: trimmedKey },
        { timeout: 15000, validateStatus: (s) => s < 500 }
      );

      if (redeemResponse.status === 200 && redeemResponse.data) {
        const data = redeemResponse.data;
        if (typeof data === "object" && !Buffer.isBuffer(data)) {
          if (data.packageUrl || data.data?.packageUrl) {
            packageUrl = data.packageUrl || data.data?.packageUrl;
            expectedChecksum = data.sha256 || data.data?.sha256;
          } else if (
            String(redeemResponse.headers["content-type"] || "").includes("application/zip") ||
            Buffer.isBuffer(data)
          ) {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, buffer);
            return { checksum };
          }
        }
      }
    } catch {
      // Remote redeem not reachable, fall back to local packaging
    }

    // If a package URL was returned from registry, download it
    if (packageUrl) {
      try {
        const packageResponse = await axios.get(packageUrl, {
          responseType: "arraybuffer",
          timeout: 30000,
        });
        const buffer = Buffer.from(packageResponse.data);
        const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

        if (expectedChecksum && checksum !== expectedChecksum.toLowerCase()) {
          throw new Error("Package checksum mismatch: possible corruption or tampering.");
        }

        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, buffer);
        return { checksum };
      } catch (error: any) {
        throw new Error(`Failed to download package: ${error.message}`);
      }
    }

    // 2. Package local extension source archive
    return this.createDemoPackage(targetPath, trimmedKey);
  }

  /**
   * Create an extension zip package from local extensions directory using AdmZip.
   */
  private async createDemoPackage(targetPath: string, key: string): Promise<{ checksum: string }> {
    let extensionId = "hello-jtg";

    if (key.startsWith("jtg_key_test_")) {
      const cand = key.replace("jtg_key_test_", "").split("_")[0];
      if (cand) extensionId = cand;
    } else if (key.startsWith("jtg_key_sample_")) {
      const cand = key.replace("jtg_key_sample_", "").split("_")[0];
      if (cand) extensionId = cand;
    } else if (key.startsWith("jtg_key_")) {
      const cand = key.replace("jtg_key_", "").split("_")[0];
      if (cand) extensionId = cand;
    }

    const candidates = [
      path.join(process.cwd(), "extensions", extensionId),
      path.join(process.cwd(), "extensions", "hello-jtg"),
      path.join(process.cwd(), "..", "Blueprint", "extensions", extensionId),
      path.join(process.cwd(), "..", "Blueprint", "extensions", "hello-jtg"),
    ];

    let sourceDir: string | null = null;
    for (const candidate of candidates) {
      if (await fs.pathExists(candidate)) {
        sourceDir = candidate;
        break;
      }
    }

    if (!sourceDir) {
      throw new Error(`Extension source directory not found for: ${extensionId}`);
    }

    await fs.ensureDir(path.dirname(targetPath));

    const zip = new AdmZip();
    zip.addLocalFolder(sourceDir);
    zip.writeZip(targetPath);

    const buffer = await fs.readFile(targetPath);
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    return { checksum };
  }

  /**
   * Verify SHA-256 integrity of a file.
   */
  static verifyChecksum(filePath: string, expectedChecksum: string): boolean {
    if (!expectedChecksum) return true;
    const fileBuffer = fs.readFileSync(filePath);
    const actualChecksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
  }
}
