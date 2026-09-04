import express, { Request, Response } from "express";
import multer from "multer";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { BlueprintExtensionManager } from "./manager.js";
import { BLUEPRINT_PERMISSIONS, validateRequestedPermissions } from "./permissions.js";

const router = express.Router();
const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max
const manager = BlueprintExtensionManager.getInstance();

/**
 * GET /api/admin/blueprint/info
 * Returns framework info and overview
 */
router.get("/info", requireAdmin, async (req: Request, res: Response) => {
  const extensions = manager.getExtensions();
  res.json({
    name: "JTG Blueprint",
    version: manager.getBlueprintVersion(),
    panelVersion: manager.getPanelVersion(),
    status: "active",
    description: "First-class extension ecosystem & runtime for JTG Panel.",
    author: {
      name: "JTG Team & Blueprint Ecosystem",
      url: "https://blue-print-jtg-panel.vercel.app",
    },
    stats: {
      totalExtensions: extensions.length,
      activeExtensions: extensions.filter((e) => e.enabled && e.status === "active").length,
    },
    registryUrl: manager.getRegistryClient().getRegistryUrl(),
  });
});

/**
 * GET /api/admin/blueprint/extensions
 * Lists all installed extensions
 */
router.get("/extensions", requireAdmin, async (req: Request, res: Response) => {
  const extensions = manager.getExtensions();
  res.json({
    blueprint: {
      id: "jtg-blueprint-core",
      name: "JTG Blueprint",
      description: "Extension framework and runtime engine.",
      version: manager.getBlueprintVersion(),
      status: "active",
      enabled: true,
      author: {
        name: "JTG Team",
        url: "https://blue-print-jtg-panel.vercel.app",
      },
      isCore: true,
    },
    extensions,
  });
});

/**
 * POST /api/admin/blueprint/extensions/validate-key
 * Validates an extension key with the central registry and returns metadata & permissions preview
 */
router.post("/extensions/validate-key", requireAdmin, async (req: Request, res: Response) => {
  const { key } = req.body;
  if (!key) {
    res.status(400).json({ error: "Extension key is required." });
    return;
  }

  try {
    const preview = await manager.getRegistryClient().validateKey(key);
    if (!preview.valid) {
      res.status(400).json({ error: preview.error || "Invalid extension key." });
      return;
    }

    const permCheck = validateRequestedPermissions(preview.permissions || []);

    res.json({
      ...preview,
      permissionDefinitions: permCheck.definitions,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to validate key with registry." });
  }
});

/**
 * POST /api/admin/blueprint/extensions/install
 * Installs extension via key or direct archive
 */
router.post(
  "/extensions/install",
  requireAdmin,
  upload.single("package"),
  async (req: Request, res: Response) => {
    try {
      const { key, grantedPermissions } = req.body;
      let parsedPermissions: any[] | undefined = undefined;
      if (typeof grantedPermissions === "string") {
        try {
          parsedPermissions = JSON.parse(grantedPermissions);
        } catch {
          parsedPermissions = grantedPermissions.split(",").map((s) => s.trim());
        }
      } else if (Array.isArray(grantedPermissions)) {
        parsedPermissions = grantedPermissions;
      }

      let installed;
      if (key && typeof key === "string" && key.trim()) {
        installed = await manager.installWithKey(key.trim(), parsedPermissions);
      } else if (req.file) {
        installed = await manager.installFromZip(req.file.buffer, parsedPermissions);
      } else {
        res.status(400).json({ error: "Either extension key or package zip file must be provided." });
        return;
      }

      res.json({
        success: true,
        message: `Extension '${installed.manifest.name}' installed successfully.`,
        extension: installed,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Installation failed." });
    }
  }
);

/**
 * POST /api/admin/blueprint/extensions/:id/enable
 */
router.post("/extensions/:id/enable", requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await manager.enableExtension(req.params.id);
    res.json({ success: true, extension: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/admin/blueprint/extensions/:id/disable
 */
router.post("/extensions/:id/disable", requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await manager.disableExtension(req.params.id);
    res.json({ success: true, extension: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/admin/blueprint/extensions/:id/update
 */
router.post(
  "/extensions/:id/update",
  requireAdmin,
  upload.single("package"),
  async (req: Request, res: Response) => {
    try {
      const { key } = req.body;
      let updated;
      if (key) {
        // Download package via key
        const tempPath = `temp_update_${req.params.id}_${Date.now()}.zip`;
        await manager.getRegistryClient().downloadPackage(key, tempPath);
        updated = await manager.updateExtension(req.params.id, tempPath);
      } else if (req.file) {
        updated = await manager.updateExtension(req.params.id, req.file.buffer);
      } else {
        res.status(400).json({ error: "Update package or extension key is required." });
        return;
      }

      res.json({ success: true, extension: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * DELETE /api/admin/blueprint/extensions/:id
 */
router.delete("/extensions/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const purgeData = req.query.purgeData === "true" || req.body?.purgeData === true;
    await manager.uninstallExtension(req.params.id, purgeData);
    res.json({ success: true, message: `Extension '${req.params.id}' uninstalled successfully.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/admin/blueprint/extensions/:id
 */
router.get("/extensions/:id", requireAdmin, async (req: Request, res: Response) => {
  const ext = manager.getExtension(req.params.id);
  if (!ext) {
    res.status(404).json({ error: "Extension not found." });
    return;
  }
  res.json({ extension: ext });
});

/**
 * GET /api/admin/blueprint/extensions/:id/configuration
 */
router.get("/extensions/:id/configuration", requireAdmin, async (req: Request, res: Response) => {
  try {
    const configData = manager.getExtensionConfiguration(req.params.id);
    res.json(configData);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/blueprint/extensions/:id/configuration
 */
router.put("/extensions/:id/configuration", requireAdmin, async (req: Request, res: Response) => {
  try {
    const saved = await manager.setExtensionConfiguration(req.params.id, req.body.config || req.body);
    res.json({ success: true, config: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/admin/blueprint/doctor
 */
router.get("/doctor", requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await manager.runDoctor();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/blueprint/permissions
 */
router.get("/permissions", requireAdmin, (req: Request, res: Response) => {
  res.json({ permissions: BLUEPRINT_PERMISSIONS });
});

/**
 * PUBLIC / USER RUNTIME ROUTES
 */

/**
 * GET /api/blueprint/runtime/navigation
 * Returns active navigation links registered by enabled extensions
 */
router.get("/runtime/navigation", requireAuth, async (req: Request, res: Response) => {
  const exts = manager.getExtensions();
  const navItems: any[] = [];

  for (const ext of exts) {
    if (ext.enabled && ext.status === "active" && ext.manifest.routes?.navItems) {
      for (const item of ext.manifest.routes.navItems) {
        navItems.push({
          ...item,
          extensionId: ext.manifest.id,
          extensionName: ext.manifest.name,
        });
      }
    }
  }

  res.json({ navItems });
});

/**
 * GET /api/blueprint/runtime/extensions
 * Returns enabled frontend extension configs/routes
 */
router.get("/runtime/extensions", async (req: Request, res: Response) => {
  const exts = manager.getExtensions();
  const activeExtensions = exts
    .filter((e) => e.enabled && e.status === "active")
    .map((e) => ({
      id: e.manifest.id,
      name: e.manifest.name,
      version: e.manifest.version,
      description: e.manifest.description,
      icon: e.manifest.icon,
      routes: e.manifest.routes,
      adminPage: e.manifest.routes?.adminPage,
      serverTab: e.manifest.routes?.serverTab,
      frontendEntry: e.manifest.entrypoints?.frontend
        ? `/extensions/${e.manifest.id}/${e.manifest.entrypoints.frontend}`
        : null,
    }));

  res.json({ extensions: activeExtensions });
});

export default router;
