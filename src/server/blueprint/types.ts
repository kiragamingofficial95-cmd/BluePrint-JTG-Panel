export type PermissionScope =
  | "servers.read"
  | "servers.write"
  | "users.read"
  | "users.write"
  | "settings.read"
  | "settings.write"
  | "filesystem.read"
  | "filesystem.write"
  | "database.read"
  | "database.write"
  | "system.execute";

export interface PermissionDefinition {
  id: PermissionScope;
  name: string;
  description: string;
  risk: "low" | "medium" | "high" | "critical";
}

export interface ExtensionAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface ExtensionCompatibility {
  jtg_panel: string;
  blueprint: string;
}

export type ConfigFieldType = "string" | "number" | "boolean" | "select" | "textarea" | "password";

export interface ConfigFieldOption {
  label: string;
  value: string | number;
}

export interface ExtensionConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  default?: any;
  options?: ConfigFieldOption[];
  description?: string;
  required?: boolean;
  min?: number;
  max?: number;
}

export interface ExtensionConfigSchema {
  fields: ExtensionConfigField[];
}

export interface ExtensionNavItem {
  title: string;
  path: string;
  icon?: string;
  section?: "main" | "server" | "admin";
  permission?: string;
}

export interface ExtensionRoutes {
  apiPrefix?: string;
  adminPage?: {
    path: string;
    title: string;
    icon?: string;
  };
  serverTab?: {
    path: string;
    title: string;
    icon?: string;
  };
  navItems?: ExtensionNavItem[];
}

export interface BlueprintManifest {
  $schema?: string;
  id: string;
  name: string;
  version: string;
  description: string;
  author: ExtensionAuthor;
  icon?: string;
  category?: string;
  tags?: string[];
  homepage?: string;
  repository?: string;
  license?: string;
  compatibility: ExtensionCompatibility;
  dependencies?: Record<string, string>;
  permissions?: PermissionScope[];
  entrypoints?: {
    backend?: string;
    frontend?: string;
  };
  routes?: ExtensionRoutes;
  configSchema?: ExtensionConfigSchema;
}

export type ExtensionStatus = "active" | "disabled" | "error" | "incompatible";

export interface InstalledExtension {
  manifest: BlueprintManifest;
  installedAt: string;
  updatedAt: string;
  enabled: boolean;
  status: ExtensionStatus;
  errorMessage?: string;
  localPath: string;
  checksum?: string;
  grantedPermissions: PermissionScope[];
}

export interface BlueprintAuditLogEntry {
  id: string;
  timestamp: string;
  action: "install" | "uninstall" | "enable" | "disable" | "update" | "configure";
  extensionId: string;
  user?: string;
  details?: Record<string, any>;
}

export interface BlueprintState {
  version: string;
  registryUrl: string;
  extensions: Record<string, InstalledExtension>;
  configs: Record<string, Record<string, any>>;
  migrations: Record<string, string[]>;
  auditLog: BlueprintAuditLogEntry[];
}

export interface ExtensionContext {
  extensionId: string;
  version: string;
  config: Record<string, any>;
  logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
  permissions: PermissionScope[];
  dataPath: string;
  getConfig: <T = any>(key: string, defaultValue?: T) => T;
  setConfig: (key: string, value: any) => Promise<void>;
  db: {
    get: (collection: string, query?: Record<string, any>) => Promise<any[]>;
    set: (collection: string, id: string, doc: any) => Promise<void>;
    remove: (collection: string, id: string) => Promise<void>;
  };
}

export interface IBlueprintExtension {
  install?: (context: ExtensionContext) => Promise<void> | void;
  enable?: (context: ExtensionContext) => Promise<void> | void;
  disable?: (context: ExtensionContext) => Promise<void> | void;
  update?: (fromVersion: string, toVersion: string, context: ExtensionContext) => Promise<void> | void;
  uninstall?: (context: ExtensionContext, purgeData?: boolean) => Promise<void> | void;
}

export interface DoctorIssue {
  type: "error" | "warning" | "info";
  extensionId?: string;
  message: string;
  resolution?: string;
}

export interface DoctorReport {
  overallStatus: "healthy" | "warnings" | "critical";
  frameworkVersion: string;
  panelVersion: string;
  activeExtensionsCount: number;
  totalExtensionsCount: number;
  issues: DoctorIssue[];
}
