# Blueprint Manifest Specification (`blueprint.json`)

The `blueprint.json` file is required at the root of every extension package.

---

## Schema & Top-Level Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `$schema` | `string` | No | Schema definition URL. |
| `id` | `string` | **Yes** | Lowercase alphanumeric identifier (`[a-z0-9-_]+`). |
| `name` | `string` | **Yes** | Display name shown in UI and marketplace. |
| `version` | `string` | **Yes** | Semantic version (e.g. `1.0.0`). |
| `description` | `string` | **Yes** | Concise description of extension features. |
| `author` | `object` | **Yes** | Object with `name`, `email`, and `url`. |
| `icon` | `string` | No | Lucide icon name (e.g. `Sparkles`, `Bell`, `Box`). |
| `category` | `string` | No | Marketplace category (`utilities`, `integrations`, `monitoring`, `security`, `gaming`). |
| `tags` | `string[]` | No | Search keywords and tags. |
| `license` | `string` | No | License identifier (e.g. `MIT`, `Apache-2.0`). |
| `compatibility`| `object` | **Yes** | Version requirements for `jtg_panel` and `blueprint`. |
| `permissions` | `string[]` | No | Array of required permission scopes. |
| `entrypoints` | `object` | No | Paths to `backend` and `frontend` modules. |
| `routes` | `object` | No | `apiPrefix`, `adminPage`, `serverTab`, `navItems`. |
| `configSchema` | `object` | No | Form field definitions for extension settings. |

---

## Configuration Schema Example

```json
{
  "configSchema": {
    "fields": [
      {
        "key": "apiKey",
        "label": "External API Key",
        "type": "password",
        "required": true,
        "description": "API token provided by external service."
      },
      {
        "key": "syncInterval",
        "label": "Sync Interval (Minutes)",
        "type": "number",
        "default": 15,
        "min": 1,
        "max": 1440
      },
      {
        "key": "enableDebug",
        "label": "Enable Verbose Logging",
        "type": "boolean",
        "default": false
      }
    ]
  }
}
```
