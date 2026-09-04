# Permission Scopes & Sandboxing

JTG Blueprint implements an explicit permission declaration model.

---

## Permission Scopes Table

| Scope | Risk Level | Description |
|---|---|---|
| `servers.read` | Low | Read server list, container status, CPU/RAM, and players. |
| `servers.write` | High | Start, stop, create, or modify server instances. |
| `users.read` | Medium | Read registered user accounts and profiles. |
| `users.write` | High | Modify user credentials, roles, and permissions. |
| `settings.read` | Low | Read panel theme and public configuration. |
| `settings.write` | High | Update global system and panel options. |
| `filesystem.read`| Medium | Browse and inspect server volume files. |
| `filesystem.write`| High | Write, upload, or delete server volume files. |
| `database.read` | Low | Query extension's isolated database. |
| `database.write`| Medium | Save documents to extension's database. |
| `system.execute`| Critical | Execute elevated host-level CLI commands. |

---

## Admin Confirmation Gate

Before any extension is installed, the panel displays an interactive **Permission Consent Modal** highlighting every requested permission with color-coded risk indicators.
