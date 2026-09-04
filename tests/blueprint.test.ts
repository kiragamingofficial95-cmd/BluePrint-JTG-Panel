import assert from "assert";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { BlueprintExtensionManager } from "../src/server/blueprint/manager.js";
import { validateExtensionManifest } from "../src/blueprint/sdk/validator.js";
import { validateRequestedPermissions, BLUEPRINT_PERMISSIONS } from "../src/server/blueprint/permissions.js";
import { RegistryClient } from "../src/server/blueprint/registryClient.js";
import { MigrationRunner } from "../src/server/blueprint/migrations.js";

async function runTests() {
  console.log("\n=======================================================");
  console.log("    RUNNING JTG BLUEPRINT AUTOMATED TEST SUITE        ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message || err);
      failed++;
    }
  };

  // 1. Manifest Validation Tests
  await test("Manifest Validator: Valid Manifest", () => {
    const validManifest = {
      id: "valid-extension",
      name: "Valid Extension",
      version: "1.0.0",
      description: "A valid test extension.",
      author: { name: "Tester" },
      compatibility: { jtg_panel: ">=2.0.0", blueprint: ">=1.0.0" },
      permissions: ["servers.read"],
    };
    const res = validateExtensionManifest(validManifest);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  await test("Manifest Validator: Rejects Invalid ID", () => {
    const invalidIdManifest = {
      id: "Invalid ID with Spaces!!",
      name: "Test",
      version: "1.0.0",
      description: "Test",
      compatibility: { jtg_panel: ">=2.0.0", blueprint: ">=1.0.0" },
    };
    const res = validateExtensionManifest(invalidIdManifest);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("id")));
  });

  await test("Manifest Validator: Rejects Missing Compatibility", () => {
    const noCompatManifest = {
      id: "no-compat",
      name: "No Compat",
      version: "1.0.0",
      description: "Test",
    };
    const res = validateExtensionManifest(noCompatManifest);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("compatibility")));
  });

  // 2. Semver Compatibility Tests
  await test("Semver Resolver: Valid Matching", () => {
    assert.strictEqual(BlueprintExtensionManager.satisfiesVersion("2.0.0", ">=2.0.0"), true);
    assert.strictEqual(BlueprintExtensionManager.satisfiesVersion("2.1.5", ">=2.0.0"), true);
    assert.strictEqual(BlueprintExtensionManager.satisfiesVersion("1.0.0", ">=1.0.0"), true);
  });

  await test("Semver Resolver: Incompatible Versions", () => {
    assert.strictEqual(BlueprintExtensionManager.satisfiesVersion("1.5.0", ">=2.0.0"), false);
    assert.strictEqual(BlueprintExtensionManager.satisfiesVersion("3.0.0", "<2.0.0"), false);
  });

  // 3. Permission System Tests
  await test("Permissions: Validate Valid Scopes", () => {
    const res = validateRequestedPermissions(["servers.read", "settings.read"]);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.definitions.length, 2);
    assert.strictEqual(res.definitions[0].id, "servers.read");
  });

  await test("Permissions: Flag Unknown Scopes", () => {
    const res = validateRequestedPermissions(["servers.read", "non.existent.permission"]);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("non.existent.permission")));
  });

  // 4. Checksum & Package Integrity
  await test("Integrity: SHA-256 Checksum Verification", async () => {
    const tempFile = path.join(process.cwd(), ".data", "temp", "checksum-test.tmp");
    await fs.ensureDir(path.dirname(tempFile));
    await fs.writeFile(tempFile, "JTG Blueprint Test Package Content");

    const expectedChecksum = crypto.createHash("sha256").update("JTG Blueprint Test Package Content").digest("hex");
    const verified = RegistryClient.verifyChecksum(tempFile, expectedChecksum);
    assert.strictEqual(verified, true);

    const badChecksumVerified = RegistryClient.verifyChecksum(tempFile, "bad_checksum_hash");
    assert.strictEqual(badChecksumVerified, false);
    await fs.remove(tempFile);
  });

  // 5. Path Traversal Archive Prevention
  await test("Security: Block Path Traversal and Invalid Extensions", () => {
    const manager = BlueprintExtensionManager.getInstance();
    const badManifestVal = manager.validateManifest({
      id: "../evil-extension",
      name: "Evil",
      version: "1.0.0",
      compatibility: { jtg_panel: ">=2.0.0", blueprint: ">=1.0.0" },
    });
    assert.strictEqual(badManifestVal.valid, false);
    assert.ok(badManifestVal.errors.some((e) => e.includes("Path traversal") || e.includes("Invalid extension id")));
  });

  // 6. Scoped Extension Database & Migration Tests
  await test("Scoped Database & Migrations Execution", async () => {
    const testExtId = "test-db-ext";
    const testDir = path.join(process.cwd(), ".data", "temp", testExtId);
    const migDir = path.join(testDir, "database", "migrations");
    await fs.ensureDir(migDir);

    await fs.writeJson(path.join(migDir, "001_seed.json"), {
      initialFlag: true,
      role: "administrator",
    });

    const contextData: any = {};
    const updatedMigrations = await MigrationRunner.runExtensionMigrations(
      testExtId,
      testDir,
      [],
      {
        extensionId: testExtId,
        dataPath: testDir,
        readData: async (file) => contextData[file] || null,
        writeData: async (file, data) => { contextData[file] = data; },
        logger: { info: () => {}, error: () => {} },
      }
    );

    assert.strictEqual(updatedMigrations.length, 1);
    assert.strictEqual(updatedMigrations[0], "001_seed.json");
    assert.strictEqual(contextData["ext_test-db-ext_001_seed.json"].initialFlag, true);

    await fs.remove(testDir);
  });

  // 7. Reference Extension 'hello-jtg' Full Validation
  await test("Reference Extension: hello-jtg Manifest & Build", async () => {
    const helloManifestPath = path.join(process.cwd(), "extensions", "hello-jtg", "blueprint.json");
    assert.strictEqual(await fs.pathExists(helloManifestPath), true);

    const manifest = await fs.readJson(helloManifestPath);
    const val = validateExtensionManifest(manifest);
    assert.strictEqual(val.valid, true);
    assert.strictEqual(manifest.id, "hello-jtg");
    assert.strictEqual(manifest.version, "1.0.0");
  });

  // 8. Configuration Scoping & Setting
  await test("Configuration Manager: Save & Retrieve Scoped Config", async () => {
    const manager = BlueprintExtensionManager.getInstance();
    await manager.discoverAndSync();
    const configResult = await manager.setExtensionConfiguration("hello-jtg", {
      greetingMessage: "Automated Test Greeting",
      alertThreshold: 25,
    });
    assert.strictEqual(configResult.greetingMessage, "Automated Test Greeting");
    assert.strictEqual(configResult.alertThreshold, 25);
  });

  // 9. Doctor Diagnostics
  await test("Blueprint Doctor: Diagnostics Report", async () => {
    const manager = BlueprintExtensionManager.getInstance();
    const report = await manager.runDoctor();
    assert.strictEqual(report.frameworkVersion, "1.0.0");
    assert.strictEqual(report.panelVersion, "2.0.0");
    assert.ok(["healthy", "warnings", "critical"].includes(report.overallStatus));
  });

  // Summary
  console.log("\n-------------------------------------------------------");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test Suite Fatal Error:", e);
  process.exit(1);
});
