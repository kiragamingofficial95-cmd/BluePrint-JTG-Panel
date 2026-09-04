# Security, Isolation & Trust Model

Security is a foundational pillar of the JTG Blueprint ecosystem.

---

## 1. Trust Model
- Installing an extension executes JavaScript/TypeScript in the panel application space.
- Administrators MUST only install extensions from trusted developers or the official JTG Blueprint Registry.
- Every installation requires explicit review of requested permission scopes.

---

## 2. Integrity Protections
- **SHA-256 Checksums:** Packages downloaded from the registry are validated against the cryptographic release digest.
- **Path Traversal Protection:** Archive extractors reject any file containing relative `..` segments or absolute path references.
- **Atomic Rollback:** If an installation or migration throws an error, the previous version is restored automatically from backup.

---

## 3. Failure Resilience & Doctor
- **Route Isolation:** Uncaught exceptions inside extension routes are trapped by Express middleware and return HTTP 500 error envelopes without halting the JTG Panel HTTP daemon.
- **Emergency CLI:** If an extension causes issues, run `jtg-blueprint disable <id>` or `jtg-blueprint doctor` to restore panel access immediately.
