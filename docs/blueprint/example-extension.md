# Reference Extension Walkthrough (`hello-jtg`)

The `hello-jtg` extension (`extensions/hello-jtg/`) demonstrates all core capabilities of JTG Blueprint.

---

## Structure
```
extensions/hello-jtg/
├── blueprint.json                           # Manifest
├── README.md                                # Docs
├── LICENSE                                  # MIT
├── src/
│   ├── server/index.js                      # Backend API & Lifecycle hooks
│   └── client/index.js                      # Client module
├── database/migrations/
│   └── 001_initial_schema.json              # Initial seed migration
└── config/
    └── default.json                         # Config presets
```

---

## Endpoints Provided
- `GET /api/extensions/hello-jtg/status` — Returns online status and feature list.
- `GET /api/extensions/hello-jtg/greet` — Returns custom greeting message configured in admin settings.

---

## Admin Interface
- Dynamically mounted under **Admin Settings → Blueprint Extensions → Hello JTG**.
- Configurable settings: Greeting Message, Public Banner Toggle, Alert Threshold.
