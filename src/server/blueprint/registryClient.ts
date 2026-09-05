import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import axios from "axios";
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

export class RegistryClient {
  private registryUrl: string;

  constructor(registryUrl = process.env.BLUEPRINT_REGISTRY_URL || "https://blueprint.jtgpanel.com") {
    this.registryUrl = registryUrl.replace(/\/$/, "");
  }

  setRegistryUrl(url: string) {
    this.registryUrl = url.replace(/\/$/, "");
  }

  getRegistryUrl(): string {
    return this.registryUrl;
  }

  /**
   * Validate an extension key with the Registry without downloading the package yet.
   */
  async validateKey(key: string): Promise<KeyValidationResult> {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return { valid: false, key, error: "Extension key cannot be empty." };
    }

    try {
      // Call registry endpoint
      const response = await axios.post(
        `${this.registryUrl}/api/v1/keys/validate`,
        { key: trimmedKey },
        { timeout: 15000, validateStatus: () => true }
      );

      const data = response.data;

      // Serverless format: { valid: true, extension: {...} }
      if (data && (data.valid || data.data?.valid)) {
        const ext = data.extension || data.data?.extension || {};
        return {
          valid: true,
          key: trimmedKey,
          extensionId: ext.id || data.extensionId || data.data?.extensionId,
          extensionName: ext.name || data.extensionName || data.name,
          version: data.version || ext.version,
          description: ext.description || data.description,
          author: ext.author || data.author,
          icon: ext.icon || data.icon,
          compatibility: ext.compatibility || data.compatibility,
          permissions: data.permissions || [],
          packageUrl: data.packageUrl,
          checksum: data.checksum,
        };
      }

      return {
        valid: false,
        key: trimmedKey,
        error: data?.error || data?.data?.error || data?.message || "Invalid extension key.",
      };
    } catch (err: any) {
      // If offline/fallback simulation mode for test keys
      if (trimmedKey.startsWith("jtg_key_demo_") || trimmedKey.startsWith("jtg_key_hello_")) {
        return {
          valid: true,
          key: trimmedKey,
          extensionId: "hello-jtg",
          extensionName: "Hello JTG",
          version: "1.0.0",
          description: "Official example extension demonstrating JTG Blueprint capabilities.",
          author: { name: "JTG Team", url: "https://github.com/kiragamingofficial95-cmd" },
          icon: "Sparkles",
          compatibility: { jtg_panel: ">=2.0.0", blueprint: ">=1.0.0" },
          permissions: ["servers.read", "settings.read"],
        };
      }

      return {
        valid: false,
        key: trimmedKey,
        error: err.response?.data?.error || err.message || "Failed to reach Blueprint Registry.",
      };
    }
  }

  /**
   * Redeem the key and download package archive to a temporary file.
   * Handles two response formats:
   *   1. Serverless registry returns JSON: { packageUrl, sha256, expires }
   *   2. Local registry returns binary .blueprint package
   */
  async downloadPackage(key: string, targetPath: string): Promise<{ checksum: string; manifest?: BlueprintManifest }> {
    const trimmedKey = key.trim();

    // First redeem the key to get package URL
    let packageUrl: string;
    let expectedChecksum: string | undefined;

    try {
      const redeemResponse = await axios.post(
        `${this.registryUrl}/api/v1/keys/redeem`,
        { key: trimmedKey },
        { timeout: 15000, validateStatus: () => true }
      );

      const data = redeemResponse.data;

      // Serverless mode: JSON response with packageUrl
      if (typeof data === "object" && data !== null && !Buffer.isBuffer(data)) {
        if (data.packageUrl) {
          packageUrl = data.packageUrl;
          expectedChecksum = data.sha256;
        } else if (data.data?.packageUrl) {
          packageUrl = data.data.packageUrl;
          expectedChecksum = data.data.sha256;
        } else {
          // Try treating response as the package itself
          const buffer = Buffer.from(redeemResponse.data);
          const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
          await fs.ensureDir(path.dirname(targetPath));
          await fs.writeFile(targetPath, buffer);
          return { checksum };
        }
      } else {
        // Direct binary package response
        const buffer = Buffer.from(redeemResponse.data);
        const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, buffer);
        return { checksum };
      }
    } catch (error: any) {
      // Fallback: try downloading directly from package URL if validateKey gave us one
      // or use demo key simulation
      if (trimmedKey.startsWith("jtg_key_demo_") || trimmedKey.startsWith("jtg_key_hello_")) {
        // Demo key - create placeholder package for hello-jtg
        return this.createDemoPackage(targetPath, trimmedKey);
      }
      throw new Error(error.response?.data?.error || error.message || "Failed to redeem key from Registry.");
    }

    // Download the package from the packageUrl
    if (!packageUrl) {
      throw new Error("No package URL returned from registry.");
    }

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

  /**
   * Create a demo package for offline testing when registry is unreachable.
   */
  private async createDemoPackage(targetPath: string, key: string): Promise<{ checksum: string }> {
    const fs = await import("fs-extra");
    const path = await import("path");
    const { ZipArchive: ArchiverZip } = await import("archiver");

    // Determine which extension to use
    const isHelloJtg = key.startsWith("jtg_key_hello_");
    const extensionId = isHelloJtg ? "hello-jtg" : "key-validator";

    // Look for extension in extensions directory
    const candidates = [
      path.join(process.cwd(), "extensions", extensionId),
      path.join(process.cwd(), "..", "Blueprint", "extensions", extensionId),
    ];

    let sourceDir: string | null = null;
    for (const candidate of candidates) {
      if (await fs.pathExists(candidate)) {
        sourceDir = candidate;
        break;
      }
    }

    if (!sourceDir) {
      throw new Error(`Demo extension source not found for: ${extensionId}`);
    }

    // Create zip from extension directory
    await fs.ensureDir(path.dirname(targetPath));
    const output = fs.createWriteStream(targetPath);
    const archive = new ArchiverZip({ zlib: { level: 9 } });

    await new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });

    const buffer = fs.readFileSync(targetPath);
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
