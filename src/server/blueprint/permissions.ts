import { PermissionDefinition, PermissionScope } from "./types.js";

export const BLUEPRINT_PERMISSIONS: Record<PermissionScope, PermissionDefinition> = {
  "servers.read": {
    id: "servers.read",
    name: "Read Server Information",
    description: "Allows the extension to view server lists, status, ports, and metadata.",
    risk: "low",
  },
  "servers.write": {
    id: "servers.write",
    name: "Manage Servers",
    description: "Allows the extension to create, start, stop, restart, or modify servers.",
    risk: "high",
  },
  "users.read": {
    id: "users.read",
    name: "Read User Accounts",
    description: "Allows the extension to query user accounts and roles.",
    risk: "medium",
  },
  "users.write": {
    id: "users.write",
    name: "Manage Users",
    description: "Allows the extension to modify user roles, accounts, and credentials.",
    risk: "high",
  },
  "settings.read": {
    id: "settings.read",
    name: "Read System Settings",
    description: "Allows the extension to read panel configurations and branding settings.",
    risk: "low",
  },
  "settings.write": {
    id: "settings.write",
    name: "Modify System Settings",
    description: "Allows the extension to change global panel configuration and system options.",
    risk: "high",
  },
  "filesystem.read": {
    id: "filesystem.read",
    name: "Read Server Files",
    description: "Allows the extension to browse and read files inside server volumes.",
    risk: "medium",
  },
  "filesystem.write": {
    id: "filesystem.write",
    name: "Modify Server Files",
    description: "Allows the extension to write, edit, upload, or delete server files.",
    risk: "high",
  },
  "database.read": {
    id: "database.read",
    name: "Read Extension Database",
    description: "Allows the extension to query its scoped database collections.",
    risk: "low",
  },
  "database.write": {
    id: "database.write",
    name: "Write Extension Database",
    description: "Allows the extension to persist data into its scoped collections.",
    risk: "medium",
  },
  "system.execute": {
    id: "system.execute",
    name: "Execute Host System Commands",
    description: "CRITICAL: Allows the extension to run host-level command line binaries.",
    risk: "critical",
  },
};

export function getPermissionDetails(scope: PermissionScope): PermissionDefinition {
  return BLUEPRINT_PERMISSIONS[scope] || {
    id: scope,
    name: scope,
    description: "Custom permission scope requested by extension.",
    risk: "medium",
  };
}

export function validateRequestedPermissions(permissions: string[] = []): { valid: boolean; errors: string[]; definitions: PermissionDefinition[] } {
  const errors: string[] = [];
  const definitions: PermissionDefinition[] = [];

  for (const perm of permissions) {
    if (perm in BLUEPRINT_PERMISSIONS) {
      definitions.push(BLUEPRINT_PERMISSIONS[perm as PermissionScope]);
    } else {
      errors.push(`Unknown permission requested: ${perm}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    definitions,
  };
}
