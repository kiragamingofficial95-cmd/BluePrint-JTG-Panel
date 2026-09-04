# JTG Blueprint Architecture Specification

**Version:** 1.0.0  
**Status:** Approved  
**Target:** JTG Panel (v2.0+) & JTG Blueprint Extension Ecosystem  

---

## 1. Executive Summary

**JTG Blueprint** is the official first-class extension ecosystem and framework for **JTG Panel**. It empowers third-party developers to create, test, package, and publish extensions through an official registry, and provides JTG Panel administrators with a streamlined, secure one-click installation and configuration experience via cryptographically secure **Extension Keys**.

The ecosystem comprises two decoupled components:
1. **JTG Blueprint Framework (Panel Core):** Lives inside the JTG Panel application to discover, validate, execute lifecycle hooks, isolate errors, manage permissions, run database migrations, and mount frontend/backend extension components safely.
2. **JTG Blueprint Registry & Website (`BluePrint/`):** A standalone, fully deployable web application (ready for Vercel or Node environments) hosting the public marketplace, extension directory, developer portal, documentation, submission review engine, and secure key-generation services.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    JTG Blueprint Registry (BluePrint/)                  │
│                                                                         │
│  ┌───────────────┐   ┌───────────────────────┐   ┌───────────────────┐  │
│  │  Marketplace  │   │  Developer Portal     │   │ Key Gen & Auth    │  │
│  │  & Discovery  │   │  & Package Validator  │   │ Registry API (v1) │  │
│  └───────────────┘   └───────────────────────┘   └───────────────────┘  │
└────────────────────────────────────▲────────────────────────────────────┘
                                     │ HTTPS (Validated Extension Key)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         JTG Panel (Instance)                            │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                   JTG Blueprint Extension Manager                 │  │
│  │                                                                   │  │
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────────┐ │  │
│  │ │ Integrity/Key   │ │ Manifest &      │ │ Lifecycle Engine      │ │  │
│  │ │ Validator (SHA) │ │ Permission Gate │ │ (Install/Update/Roll) │ │  │
│  │ └─────────────────┘ └─────────────────┘ └───────────────────────┘ │  │
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────────┐ │  │
│  │ │ Safe Router &   │ │ Migration & DB  │ │ Frontend Dynamic     │ │  │
│  │ │ API Dispatcher  │ │ Scoper          │ │ Injection Runtime     │ │  │
│  │ └─────────────────┘ └─────────────────┘ └───────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Installed Extensions (.extensions/)            │  │
│  │  ├── hello-jtg/ (Manifest, Backend, Frontend, Migrations, Config) │  │
│  │  └── custom-ext/ ...                                              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architecture Components

### A. JTG Panel Extension Manager
- **Storage Directory:** `extensions/` (or `.data/extensions/`).
- **Metadata State:** `.data/blueprint.json` maintains the state of all installed extensions, configurations, applied migrations, permissions, and audit logs.
- **Isolation & Error Resilience:**
  - Dynamic module loading wrapped with runtime `try/catch` and safe execution boundaries.
  - Faulty extension routes return HTTP 500 error envelopes without halting the master Express server.
  - Broken UI components are caught via React Error Boundaries so the panel navigation and Admin Settings remain accessible.
  - Safe-mode and `jtg-blueprint doctor` CLI provide emergency disablement and recovery.

### B. JTG Blueprint Registry (`BluePrint/`)
- Fully autonomous web application located in `BluePrint/`.
- No parent dependencies (`../`).
- Supports Vercel deployment with serverless API routes or standalone Node.js server.
- Built-in extension registry catalog, release manager, cryptographic key generation, SHA-256 package verification, documentation engine, and submission form.

### C. JTG Blueprint Developer SDK
- Provides standardized TypeScript interfaces, manifest validator, helper utilities, lifecycle base classes, configuration schema builders, and CLI toolchain (`jtg-blueprint`).

---

## 3. Extension Manifest Specification (`blueprint.json`)

Every JTG Blueprint extension archive MUST include a valid `blueprint.json` manifest at its root:

```json
{
  "$schema": "https://blueprint.jtgpanel.com/schema/v1.json",
  "id": "hello-jtg",
  "name": "Hello JTG",
  "version": "1.0.0",
  "description": "Official example extension demonstrating Blueprint capabilities.",
  "author": {
    "name": "JTG Team",
    "email": "dev@jtgpanel.com",
    "url": "https://github.com/kiragamingofficial95-cmd"
  },
  "icon": "sparkles",
  "category": "utilities",
  "tags": ["example", "demo", "starter"],
  "homepage": "https://blueprint.jtgpanel.com/extensions/hello-jtg",
  "repository": "https://github.com/kiragamingofficial95-cmd/jtg-blueprint-hello",
  "license": "MIT",
  "compatibility": {
    "jtg_panel": ">=2.0.0",
    "blueprint": ">=1.0.0"
  },
  "dependencies": {},
  "permissions": [
    "servers.read",
    "settings.read"
  ],
  "entrypoints": {
    "backend": "src/server/index.js",
    "frontend": "src/client/index.js"
  },
  "routes": {
    "apiPrefix": "/api/extensions/hello-jtg",
    "adminPage": {
      "path": "/admin/extensions/hello-jtg",
      "title": "Hello JTG",
      "icon": "sparkles"
    },
    "navItems": [
      {
        "title": "Hello JTG",
        "path": "/admin/extensions/hello-jtg",
        "icon": "Sparkles",
        "section": "admin"
      }
    ]
  },
  "configSchema": {
    "fields": [
      {
        "key": "greetingMessage",
        "label": "Custom Greeting Message",
        "type": "string",
        "default": "Welcome to JTG Panel powered by Blueprint!",
        "description": "The message displayed on the dashboard widget.",
        "required": true
      },
      {
        "key": "enablePublicWidget",
        "label": "Enable Public Widget",
        "type": "boolean",
        "default": true,
        "description": "Whether to expose the hello banner to all users."
      },
      {
        "key": "maxAlerts",
        "label": "Maximum Alerts Limit",
        "type": "number",
        "default": 5,
        "min": 1,
        "max": 50,
        "description": "Max server alerts to process concurrently."
      }
    ]
  }
}
```

---

## 4. Extension Lifecycle

The Extension Manager governs a strict state machine:

```
[ Registry Key ] 
       │ Validate & Preview
       ▼
[ Validated ] ──(Admin Confirms Permissions)──► [ Downloading & Verifying SHA256 ]
                                                          │
                                                          ▼
                                                [ Extracting Package ]
                                                          │
                                                          ▼
                                                [ Running Migrations ]
                                                          │
                                                          ▼
                                                [ Lifecycle: install() ]
                                                          │
                                                          ▼
                                                [ Lifecycle: enable() ]
                                                          │
                                                          ▼
                                                [ Active / Mounted ]
                                                 │        ▲
                                        disable()│        │enable()
                                                 ▼        │
                                                [ Disabled ]
                                                 │
                                                 │ update() or uninstall()
                                                 ▼
                                   [ Uninstall / Cleanup / Wipe ]
```

### Lifecycle Hook Interfaces (Backend)
```typescript
export interface IBlueprintExtension {
  install(context: ExtensionContext): Promise<void>;
  enable(context: ExtensionContext): Promise<void>;
  disable(context: ExtensionContext): Promise<void>;
  update(fromVersion: string, toVersion: string, context: ExtensionContext): Promise<void>;
  uninstall(context: ExtensionContext, purgeData: boolean): Promise<void>;
}
```

---

## 5. Security Model & Permission System

### Trust Model
- Installing an extension executes code in the JTG Panel application space.
- The administrator is presented with a **Permission Confirmation Gate** disclosing all requested permissions before installation is committed.
- Sensitive operations require declared permissions.

### Permission Matrix
| Permission Scope | Risk Level | Description |
|---|---|---|
| `servers.read` | Low | Read server lists, metadata, and runtime metrics |
| `servers.write` | High | Create, update, start, stop, or delete server instances |
| `users.read` | Medium | Read user account profiles and roles |
| `users.write` | High | Modify user permissions, passwords, and roles |
| `settings.read` | Low | Read public panel settings and theme configuration |
| `settings.write` | High | Modify system-level panel configuration |
| `filesystem.read` | Medium | Read server files inside allocated container volumes |
| `filesystem.write` | High | Edit/Delete server files inside allocated container volumes |
| `database.read` | Low | Query extension-scoped storage tables |
| `database.write` | Medium | Read/Write to extension-scoped database tables |
| `system.execute` | Critical | Execute elevated host-level CLI commands |

---

## 6. Secure Extension Key & Registry Protocol

Extension keys are issued by the JTG Blueprint Registry using cryptographically secure tokens (`jtg_key_<random_hex_32>`).

```
Panel                              Registry
  │                                    │
  ├────── POST /api/v1/keys/validate ─►│ (Validate key format & expiration)
  │◄───── Return Metadata & Perms ─────┤ (Returns preview without package)
  │                                    │
  │ [Admin Reviews & Accepts Modal]    │
  │                                    │
  ├────── POST /api/v1/keys/redeem ───►│ (Redeem one-time install token)
  │◄───── Return Package URL + SHA256 ─┤ (Stream package archive)
  │                                    │
  ├────── Verify SHA256 Checksum ──────┤
  ├────── Extract to extensions/{id} ──┤
  └────── Run migrations & Mount ──────┘
```

---

## 7. Database & State Architecture

All Blueprint metadata is stored in `.data/blueprint.json` using atomic file persistence:
- **`extensions`**: Catalog of installed extensions, active states, version pins, permissions, entry points.
- **`configs`**: Key-value settings partitioned per extension ID (`configs[extensionId]`).
- **`migrations`**: Applied migration timestamps per extension.
- **`auditLog`**: Log of all installs, uninstalls, toggles, and updates.

---

## 8. REST API Endpoints Specification

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/blueprint/info` | Admin | Returns Blueprint framework version and environment status |
| `GET` | `/api/admin/blueprint/extensions` | Admin | Lists all installed extensions and status |
| `POST` | `/api/admin/blueprint/extensions/validate-key` | Admin | Validates an extension key with registry and returns preview |
| `POST` | `/api/admin/blueprint/extensions/install` | Admin | Installs an extension using key or direct package |
| `POST` | `/api/admin/blueprint/extensions/:id/enable` | Admin | Enables an installed extension |
| `POST` | `/api/admin/blueprint/extensions/:id/disable` | Admin | Disables an active extension |
| `POST` | `/api/admin/blueprint/extensions/:id/update` | Admin | Updates an extension to latest version |
| `DELETE` | `/api/admin/blueprint/extensions/:id` | Admin | Uninstalls an extension (with `purgeData` query param) |
| `GET` | `/api/admin/blueprint/extensions/:id/configuration` | Admin | Fetches extension schema and saved configuration |
| `PUT` | `/api/admin/blueprint/extensions/:id/configuration` | Admin | Updates extension configuration |
| `GET` | `/api/admin/blueprint/doctor` | Admin | Diagnoses broken manifests, conflicts, or failed states |
| `GET` | `/api/blueprint/runtime/navigation` | User/Admin | Returns active dynamic navigation links for enabled extensions |

---

## 9. Standalone `BluePrint/` Registry Architecture

The `BluePrint/` directory is designed as an independent React/TypeScript/Vite/Express application with zero external imports:
- **Frontend:** Hero landing page, extension search & category filter, detailed extension view, "Get Extension Key" generator modal, developer portal & docs, extension submit portal.
- **Backend/API (or Serverless API):**
  - `GET /api/v1/extensions` - List catalog with search & tag filtering
  - `GET /api/v1/extensions/:id` - Extension detail & changelog
  - `POST /api/v1/keys/generate` - Generates a secure installation key
  - `POST /api/v1/keys/validate` - Validates an installation key
  - `POST /api/v1/keys/redeem` - Exchanges installation key for package download
  - `POST /api/v1/extensions/publish` - Submits and validates new extension release

---

## 10. Summary of Architectural Guarantees
1. **Zero Downtime:** A crashing extension cannot take down the JTG Panel daemon.
2. **Explicit Consent:** No permissions are granted without explicit admin approval.
3. **Decoupled Registry:** `BluePrint/` can be deployed independently onto Vercel without requiring the JTG Panel core files.
4. **Developer-Friendly:** Standardized TypeScript SDK, CLI commands, and complete documentation.
