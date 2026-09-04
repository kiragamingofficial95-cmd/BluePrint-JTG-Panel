import { BlueprintManifest, ExtensionConfigSchema, IBlueprintExtension } from "./types.js";

/**
 * Type-safe helper to define a JTG Blueprint Extension module
 */
export function defineExtension(extension: IBlueprintExtension): IBlueprintExtension {
  return extension;
}

/**
 * Type-safe helper to define a Blueprint Configuration Schema
 */
export function defineConfigSchema(schema: ExtensionConfigSchema): ExtensionConfigSchema {
  return schema;
}

/**
 * Type-safe helper to define a Blueprint Manifest
 */
export function defineManifest(manifest: BlueprintManifest): BlueprintManifest {
  return manifest;
}
