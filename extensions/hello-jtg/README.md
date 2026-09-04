# Hello JTG Extension

The official reference extension for **JTG Blueprint**.

## Features
- **Lifecycle Hooks:** `install()`, `enable()`, `disable()`, `update()`, and `uninstall()`.
- **Backend API Routing:** Mounts `/api/extensions/hello-jtg/status` and `/api/extensions/hello-jtg/greet`.
- **Scoped Database:** Reads and writes extension data into scoped storage via `context.db`.
- **Dynamic Configuration:** Supports configurable greeting messages and alert thresholds via Admin Settings.
- **Admin UI Page:** Automatically registers admin page and navigation items.

## Permissions
- `servers.read`: Read server overview information.
- `settings.read`: Read panel configuration settings.
