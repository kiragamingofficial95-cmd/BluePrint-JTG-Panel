# Extension Lifecycle Specification

JTG Blueprint manages a state machine for every extension:

```
[ Package / Key ]
       │
       ▼
 [ Validate ] ──(Admin Permissions Review)──► [ Extract & Migrate ]
                                                       │
                                                       ▼
                                              [ Hook: install() ]
                                                       │
                                                       ▼
                                              [ Hook: enable() ]
                                                       │
                                                       ▼
                                               [ Active / Mounted ]
                                                │        ▲
                                       disable()│        │enable()
                                                ▼        │
                                               [ Disabled ]
                                                │
                                                ▼
                                          [ Hook: uninstall() ]
                                                │
                                                ▼
                                          [ Purge / Cleaned ]
```

---

## Lifecycle Hook Handlers

```javascript
export const extension = {
  async install(context) {
    // Run initial one-time seed logic
  },

  async enable(context) {
    // Mount background listeners and timers
  },

  async disable(context) {
    // Clean up timers and teardown listeners
  },

  async update(fromVersion, toVersion, context) {
    // Run upgrade migrations
  },

  async uninstall(context, purgeData) {
    // Clean up files and optional db wipe
    if (purgeData) {
      context.logger.info("Purging extension data.");
    }
  }
};

export default extension;
```
