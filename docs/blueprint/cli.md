# JTG Blueprint CLI Reference

The `jtg-blueprint` CLI provides developer tooling and administrator recovery commands.

---

## Developer Commands

### `jtg-blueprint create <name>`
Scaffolds a complete extension starter template with manifest, backend, frontend, migrations, and documentation.

```bash
jtg-blueprint create discord-bot
```

### `jtg-blueprint validate [path]`
Validates `blueprint.json` schema, semver compatibility, entrypoint files, and permissions.

```bash
jtg-blueprint validate
```

### `jtg-blueprint build [path]`
Packages the extension into a `.blueprint` release archive and prints its SHA256 integrity hash.

```bash
jtg-blueprint build
```

---

## Administrator & Diagnostics Commands

### `jtg-blueprint list`
Lists all installed extensions and active statuses in the current JTG Panel instance.

### `jtg-blueprint doctor`
Performs comprehensive diagnostic checks:
- Verifies manifest structures
- Detects missing directories or entrypoint files
- Highlights broken migrations or inactive extensions

### `jtg-blueprint enable <id>` / `disable <id>`
Toggles an extension's active status.

### `jtg-blueprint uninstall <id> [--purge]`
Uninstalls an extension and optionally removes its configuration and database records.
