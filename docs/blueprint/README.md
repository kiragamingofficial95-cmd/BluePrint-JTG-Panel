# JTG Blueprint Documentation

Welcome to the comprehensive documentation for **JTG Blueprint**, the official extension and plugin ecosystem for JTG Game Server Management Panel.

---

## Documentation Index

1. [Getting Started](./getting-started.md) — Prerequisites, quickstart, and your first extension in 5 minutes.
2. [Manifest Reference (`blueprint.json`)](./manifest-reference.md) — Complete specification of manifest keys, schema, and version constraints.
3. [SDK & Runtime Reference](./sdk-reference.md) — Context API, scoped storage, logger, dynamic routing, and configuration schemas.
4. [Extension Lifecycle](./lifecycle.md) — State machine, hook execution sequence (`install`, `enable`, `disable`, `update`, `uninstall`).
5. [Permissions & Sandboxing](./permissions.md) — Security scopes, risk classification, and administrator consent gates.
6. [CLI Toolchain Reference](./cli.md) — Commands for scaffolding, validating, building, and running diagnostics.
7. [Registry & Extension Keys](./registry-integration.md) — Key generation, redemption protocol, SHA256 integrity verification.
8. [Security & Isolation Model](./security.md) — Threat model, path traversal safeguards, and doctor recovery.
9. [Reference Extension (`hello-jtg`)](./example-extension.md) — Complete walkthrough of the reference implementation.

---

## Architecture at a Glance

```
JTG Panel Core
   └── Blueprint Framework (Extension Manager)
          ├── Manifest & Permission Gate
          ├── Lifecycle Execution Engine
          ├── Scoped JSON Database Driver
          ├── Dynamic Express Router
          └── Admin Settings UI Integration
```
