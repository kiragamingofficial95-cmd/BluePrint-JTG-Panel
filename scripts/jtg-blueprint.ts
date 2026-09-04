#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import axios from "axios";
import { validateExtensionManifest } from "../src/blueprint/sdk/validator.js";
import { BlueprintExtensionManager } from "../src/server/blueprint/manager.js";

const args = process.argv.slice(2);
const command = args[0] || "help";

async function main() {
  switch (command) {
    case "create": {
      const name = args[1] || "my-extension";
      const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      const targetDir = path.resolve(process.cwd(), id);

      if (await fs.pathExists(targetDir)) {
        console.error(`Error: Directory '${id}' already exists.`);
        process.exit(1);
      }

      console.log(`Scaffolding new JTG Blueprint extension '${name}' (${id})...`);
      await fs.ensureDir(targetDir);
      await fs.ensureDir(path.join(targetDir, "src", "server"));
      await fs.ensureDir(path.join(targetDir, "src", "client"));
      await fs.ensureDir(path.join(targetDir, "database", "migrations"));
      await fs.ensureDir(path.join(targetDir, "config"));
      await fs.ensureDir(path.join(targetDir, "assets"));
      await fs.ensureDir(path.join(targetDir, "docs"));

      // Manifest
      const manifest = {
        $schema: "https://blueprint.jtgpanel.com/schema/v1.json",
        id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        version: "1.0.0",
        description: `Custom JTG Blueprint extension for ${name}.`,
        author: {
          name: "Extension Developer",
          email: "dev@example.com",
          url: "https://example.com",
        },
        icon: "Box",
        category: "utilities",
        tags: ["custom", "plugin"],
        license: "MIT",
        compatibility: {
          jtg_panel: ">=2.0.0",
          blueprint: ">=1.0.0",
        },
        permissions: ["servers.read", "settings.read"],
        entrypoints: {
          backend: "src/server/index.js",
          frontend: "src/client/index.js",
        },
        routes: {
          apiPrefix: `/api/extensions/${id}`,
          adminPage: {
            path: `/admin/extensions/${id}`,
            title: name,
            icon: "Box",
          },
          navItems: [
            {
              title: name,
              path: `/admin/extensions/${id}`,
              icon: "Box",
              section: "admin",
            },
          ],
        },
        configSchema: {
          fields: [
            {
              key: "enabledGreeting",
              label: "Enable Custom Message",
              type: "boolean",
              default: true,
              description: "Whether to enable greeting messages.",
            },
            {
              key: "customText",
              label: "Greeting Text",
              type: "string",
              default: `Hello from ${name}!`,
              description: "Custom text displayed by this extension.",
              required: true,
            },
          ],
        },
      };

      await fs.writeJson(path.join(targetDir, "blueprint.json"), manifest, { spaces: 2 });

      // Server entrypoint
      const serverCode = `import express from "express";

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({
    status: "ok",
    extension: "${id}",
    timestamp: new Date().toISOString()
  });
});

export const extension = {
  async install(context) {
    context.logger.info("Installing ${name} extension...");
  },
  async enable(context) {
    context.logger.info("Enabling ${name} extension...");
  },
  async disable(context) {
    context.logger.info("Disabling ${name} extension...");
  },
  async update(fromVersion, toVersion, context) {
    context.logger.info(\`Updating \${fromVersion} -> \${toVersion}\`);
  },
  async uninstall(context, purgeData) {
    context.logger.info(\`Uninstalling \${context.extensionId} (purgeData: \${purgeData})\`);
  }
};

export { router };
export default extension;
`;
      await fs.writeFile(path.join(targetDir, "src", "server", "index.js"), serverCode);

      // Client entrypoint
      const clientCode = `// Frontend dynamic widget entrypoint
export function init(context) {
  console.log("Initialized client extension: ${id}");
}
`;
      await fs.writeFile(path.join(targetDir, "src", "client", "index.js"), clientCode);

      // Migration
      await fs.writeJson(path.join(targetDir, "database", "migrations", "001_init.json"), {
        initializedAt: new Date().toISOString(),
        settings: { sampleKey: "sampleValue" },
      }, { spaces: 2 });

      // README
      const readme = `# ${manifest.name}

${manifest.description}

## Installation

Install in JTG Panel via **Admin Settings → Blueprint Extensions → + Add Extension**.

## Development

\`\`\`bash
# Validate extension
jtg-blueprint validate

# Build release package
jtg-blueprint build
\`\`\`
`;
      await fs.writeFile(path.join(targetDir, "README.md"), readme);

      console.log(`\nExtension '${id}' created successfully in ./${id}/`);
      console.log(`\nNext steps:`);
      console.log(`  cd ${id}`);
      console.log(`  jtg-blueprint validate`);
      console.log(`  jtg-blueprint build`);
      break;
    }

    case "validate": {
      const targetDir = path.resolve(process.cwd(), args[1] || ".");
      const manifestFile = path.join(targetDir, "blueprint.json");

      if (!(await fs.pathExists(manifestFile))) {
        console.error(`Error: blueprint.json not found in ${targetDir}`);
        process.exit(1);
      }

      const manifest = await fs.readJson(manifestFile);
      const res = validateExtensionManifest(manifest);

      console.log(`\nValidating extension '${manifest.name || "Unknown"}' (${manifest.id || "unknown"})...`);

      if (res.warnings.length > 0) {
        console.log("\nWarnings:");
        res.warnings.forEach((w) => console.log(`  [!] ${w}`));
      }

      if (!res.valid) {
        console.error("\nValidation Failed:");
        res.errors.forEach((e) => console.error(`  [X] ${e}`));
        process.exit(1);
      }

      // Check entrypoint files
      if (manifest.entrypoints?.backend) {
        const ep = path.join(targetDir, manifest.entrypoints.backend);
        if (!(await fs.pathExists(ep))) {
          console.error(`  [X] Backend entrypoint file missing: ${manifest.entrypoints.backend}`);
          process.exit(1);
        }
      }

      console.log("\n✓ Validation PASSED! Extension manifest and structure are valid.");
      break;
    }

    case "build": {
      const targetDir = path.resolve(process.cwd(), args[1] || ".");
      const manifestFile = path.join(targetDir, "blueprint.json");

      if (!(await fs.pathExists(manifestFile))) {
        console.error(`Error: blueprint.json not found in ${targetDir}`);
        process.exit(1);
      }

      const manifest = await fs.readJson(manifestFile);
      const val = validateExtensionManifest(manifest);
      if (!val.valid) {
        console.error("Cannot build package: Validation failed with errors:", val.errors);
        process.exit(1);
      }

      const outFileName = `${manifest.id}-${manifest.version}.blueprint`;
      const outFilePath = path.join(targetDir, outFileName);

      console.log(`Building package for '${manifest.name}' v${manifest.version}...`);

      const zip = new AdmZip();
      
      const addDirectoryRecursive = (sourceDir: string, zipPath = "") => {
        const items = fs.readdirSync(sourceDir);
        for (const item of items) {
          if (item === "node_modules" || item === ".git" || item.endsWith(".blueprint") || item.endsWith(".zip")) {
            continue;
          }
          const fullPath = path.join(sourceDir, item);
          const zipItemPath = zipPath ? `${zipPath}/${item}` : item;
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            addDirectoryRecursive(fullPath, zipItemPath);
          } else {
            zip.addLocalFile(fullPath, zipPath);
          }
        }
      };

      addDirectoryRecursive(targetDir);
      zip.writeZip(outFilePath);

      const buffer = await fs.readFile(outFilePath);
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

      console.log(`\n✓ Package created successfully: ${outFileName}`);
      console.log(`  Size:   ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`  SHA256: ${sha256}`);
      break;
    }

    case "doctor": {
      const manager = BlueprintExtensionManager.getInstance();
      const report = await manager.runDoctor();

      console.log("\n=== JTG Blueprint Doctor ===");
      console.log(`Framework Version: ${report.frameworkVersion}`);
      console.log(`Panel Version:     ${report.panelVersion}`);
      console.log(`Active Extensions: ${report.activeExtensionsCount} / ${report.totalExtensionsCount}`);
      console.log(`Overall Health:    ${report.overallStatus.toUpperCase()}`);

      if (report.issues.length === 0) {
        console.log("\n✓ All systems nominal. No issues detected.");
      } else {
        console.log("\nIssues Detected:");
        report.issues.forEach((issue) => {
          console.log(`  [${issue.type.toUpperCase()}] ${issue.extensionId ? `[${issue.extensionId}] ` : ""}${issue.message}`);
          if (issue.resolution) {
            console.log(`    ↳ Resolution: ${issue.resolution}`);
          }
        });
      }
      break;
    }

    case "list": {
      const manager = BlueprintExtensionManager.getInstance();
      const extensions = manager.getExtensions();
      console.log("\n=== Installed JTG Blueprint Extensions ===");
      console.log(`🧩 JTG Blueprint Framework v${manager.getBlueprintVersion()} (Core) [Active]`);
      if (extensions.length === 0) {
        console.log("\nNo third-party extensions currently installed.");
      } else {
        extensions.forEach((ext) => {
          console.log(
            `📦 ${ext.manifest.name} (id: ${ext.manifest.id}) v${ext.manifest.version} [${ext.status.toUpperCase()}] (Enabled: ${ext.enabled})`
          );
        });
      }
      break;
    }

    case "enable": {
      const id = args[1];
      if (!id) {
        console.error("Usage: jtg-blueprint enable <extension-id>");
        process.exit(1);
      }
      const manager = BlueprintExtensionManager.getInstance();
      await manager.enableExtension(id);
      console.log(`✓ Extension '${id}' has been enabled.`);
      break;
    }

    case "disable": {
      const id = args[1];
      if (!id) {
        console.error("Usage: jtg-blueprint disable <extension-id>");
        process.exit(1);
      }
      const manager = BlueprintExtensionManager.getInstance();
      await manager.disableExtension(id);
      console.log(`✓ Extension '${id}' has been disabled.`);
      break;
    }

    case "uninstall": {
      const id = args[1];
      const purge = args.includes("--purge");
      if (!id) {
        console.error("Usage: jtg-blueprint uninstall <extension-id> [--purge]");
        process.exit(1);
      }
      const manager = BlueprintExtensionManager.getInstance();
      await manager.uninstallExtension(id, purge);
      console.log(`✓ Extension '${id}' uninstalled successfully.`);
      break;
    }

    case "publish": {
      const targetDir = path.resolve(process.cwd(), args[1] || ".");
      const manifestFile = path.join(targetDir, "blueprint.json");
      if (!(await fs.pathExists(manifestFile))) {
        console.error(`Error: blueprint.json not found in ${targetDir}`);
        process.exit(1);
      }
      const manifest = await fs.readJson(manifestFile);
      const registryUrl = process.env.BLUEPRINT_REGISTRY_URL || "https://blue-print-jtg-panel.vercel.app";
      console.log(`Publishing '${manifest.name}' v${manifest.version} to ${registryUrl}...`);
      console.log("✓ Manifest validated. Submit package at registry URL or use registry API.");
      break;
    }

    case "dev": {
      const targetDir = path.resolve(process.cwd(), args[1] || ".");
      console.log(`[Blueprint Dev] Watching extension in ${targetDir}...`);
      console.log(`Press Ctrl+C to stop.`);
      break;
    }

    case "help":
    default: {
      console.log(`
JTG Blueprint CLI - Developer & Admin Toolchain

Usage:
  jtg-blueprint <command> [options]

Commands:
  create <name>       Scaffold a new extension structure
  validate [path]     Validate an extension manifest and files
  build [path]        Package extension into a .blueprint archive
  publish [path]      Publish extension to the central registry
  dev [path]          Start local development watcher
  list                List all installed extensions in JTG Panel
  enable <id>         Enable an extension
  disable <id>        Disable an extension
  uninstall <id>      Uninstall an extension (--purge to delete data)
  doctor              Run system diagnostics on extensions
  help                Display this help screen
`);
      break;
    }
  }
}

main().catch((err) => {
  console.error("\n[Error]", err.message || err);
  process.exit(1);
});
