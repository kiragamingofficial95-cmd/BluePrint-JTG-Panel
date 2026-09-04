// POST /api/v1/keys/validate
// Validates an extension key and returns the extension preview.
// This is called by the JTG Panel when an admin pastes a key.
// Expected request: { key: "jtg_key_..." }
// Expected response (matching the panel's RegistryClient expectations):
//   { valid: true, key, extensionId, extensionName, version, description, author, ... }
import { validateKey } from "../_lib/keys.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const { key } = req.body || {};
  if (!key || !String(key).trim()) {
    res.status(400).json({ error: "Extension key is required." });
    return;
  }

  const result = validateKey(key);
  if (result.valid) {
    res.status(200).json(result);
  } else {
    res.status(400).json({ error: result.error });
  }
}
