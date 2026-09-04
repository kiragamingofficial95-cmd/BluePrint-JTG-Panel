# JTG Blueprint Developer SDK Reference

The Developer SDK provides the context API and runtime helpers for extensions.

---

## 1. Extension Context (`context`)

When lifecycle hooks or routes execute, an `ExtensionContext` is passed:

```typescript
export interface ExtensionContext {
  extensionId: string;
  version: string;
  config: Record<string, any>;
  permissions: PermissionScope[];
  dataPath: string;
  logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
  getConfig: <T = any>(key: string, defaultValue?: T) => T;
  setConfig: (key: string, value: any) => Promise<void>;
  db: {
    get: (collection: string, query?: Record<string, any>) => Promise<any[]>;
    set: (collection: string, id: string, doc: any) => Promise<void>;
    remove: (collection: string, id: string) => Promise<void>;
  };
}
```

---

## 2. Scoped Database API (`context.db`)

Each extension receives isolated storage partitioned inside `.data/ext_data/<extensionId>/`:

```javascript
// Store a document
await context.db.set("users", "player_123", {
  username: "Steve",
  playtimeMinutes: 450,
  lastSeen: new Date().toISOString()
});

// Query documents
const allPlayers = await context.db.get("users");
const steve = await context.db.get("users", { username: "Steve" });

// Remove a document
await context.db.remove("users", "player_123");
```

---

## 3. Dynamic Configuration API

```javascript
// Read setting configured in panel admin UI
const apiKey = context.getConfig("apiKey", "default-fallback-key");
const syncRate = context.getConfig("syncInterval", 15);

// Programmatically update configuration
await context.setConfig("syncInterval", 30);
```

---

## 4. Backend Express Router

Export `router` in your `src/server/index.js` to mount endpoints under `/api/extensions/<id>`:

```javascript
import express from "express";
const router = express.Router();

router.get("/metrics", (req, res) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});

export { router };
```
