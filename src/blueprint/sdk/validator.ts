import { BlueprintManifest } from "./types.js";
import { BLUEPRINT_PERMISSIONS } from "../../server/blueprint/permissions.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateExtensionManifest(manifest: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest must be an object."], warnings: [] };
  }

  if (!manifest.id || typeof manifest.id !== "string") {
    errors.push("Field 'id' is required and must be a string.");
  } else if (!/^[a-z0-9-_]+$/.test(manifest.id)) {
    errors.push("Field 'id' must only contain lowercase alphanumeric characters, dashes, and underscores.");
  }

  if (!manifest.name || typeof manifest.name !== "string") {
    errors.push("Field 'name' is required.");
  }

  if (!manifest.version || typeof manifest.version !== "string") {
    errors.push("Field 'version' is required (e.g. 1.0.0).");
  } else if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    warnings.push("Version should follow semantic versioning (MAJOR.MINOR.PATCH).");
  }

  if (!manifest.description || typeof manifest.description !== "string") {
    errors.push("Field 'description' is required.");
  }

  if (!manifest.compatibility || typeof manifest.compatibility !== "object") {
    errors.push("Field 'compatibility' is required with 'jtg_panel' and 'blueprint' version ranges.");
  } else {
    if (!manifest.compatibility.jtg_panel) {
      errors.push("Compatibility requirement 'jtg_panel' is missing.");
    }
    if (!manifest.compatibility.blueprint) {
      errors.push("Compatibility requirement 'blueprint' is missing.");
    }
  }

  if (manifest.permissions && Array.isArray(manifest.permissions)) {
    for (const perm of manifest.permissions) {
      if (!(perm in BLUEPRINT_PERMISSIONS)) {
        errors.push(`Invalid permission '${perm}' declared.`);
      }
    }
  }

  if (manifest.configSchema?.fields && Array.isArray(manifest.configSchema.fields)) {
    for (const field of manifest.configSchema.fields) {
      if (!field.key || !field.label || !field.type) {
        errors.push("Each config field must specify 'key', 'label', and 'type'.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
