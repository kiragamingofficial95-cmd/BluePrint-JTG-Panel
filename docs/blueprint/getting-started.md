# Getting Started with JTG Blueprint

This guide walks you through creating, testing, packaging, and installing your first JTG Blueprint extension.

---

## 1. Prerequisites
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher
- **JTG Panel**: Version 2.0.0 or higher

---

## 2. Scaffold a New Extension

Use the official `jtg-blueprint` CLI:

```bash
# Scaffold extension in a new directory
jtg-blueprint create my-extension

# Change directory
cd my-extension
```

This creates the standard structure:
```
my-extension/
├── blueprint.json
├── README.md
├── LICENSE
├── src/
│   ├── server/index.js
│   └── client/index.js
├── database/migrations/001_init.json
└── config/default.json
```

---

## 3. Edit Manifest (`blueprint.json`)

```json
{
  "$schema": "https://blueprint.jtgpanel.com/schema/v1.json",
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "My first JTG Blueprint extension.",
  "author": {
    "name": "Your Name",
    "email": "dev@example.com"
  },
  "compatibility": {
    "jtg_panel": ">=2.0.0",
    "blueprint": ">=1.0.0"
  },
  "permissions": [
    "servers.read",
    "settings.read"
  ]
}
```

---

## 4. Validate Your Extension

```bash
jtg-blueprint validate
```

If any required field is missing or invalid, the CLI will output clear error descriptions.

---

## 5. Build Release Package

```bash
jtg-blueprint build
```

This creates a release archive:
`my-extension-1.0.0.blueprint`

---

## 6. Install into JTG Panel

1. Go to **JTG Panel** → **Admin Settings** → **Blueprint Extensions**.
2. Click **+ Add Extension**.
3. Choose **Upload Package** and select `my-extension-1.0.0.blueprint`.
4. Review requested permissions and confirm installation!
