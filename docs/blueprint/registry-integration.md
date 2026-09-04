# Registry & Extension Key Protocol

The JTG Blueprint Registry uses cryptographically generated **Extension Keys** to authorize installations.

---

## Key Format

Extension keys follow the format:
`jtg_key_<extensionId>_<version>_<random_hex_32>`

---

## Installation Protocol Sequence

```
1. Administrator clicks "Get Extension Key" on Registry Website.
2. Registry generates signed one-time install key.
3. Administrator pastes key into JTG Panel:
   Admin Settings → Blueprint Extensions → + Add Extension.
4. JTG Panel calls POST /api/v1/keys/validate with Registry.
5. Registry returns metadata preview & requested permissions.
6. Administrator reviews permissions and confirms.
7. JTG Panel calls POST /api/v1/keys/redeem.
8. Panel verifies SHA256 checksum, runs migrations, executes install() hook, and enables module.
```
