// POST /api/v1/keys/generate
// Issues a one-time install key for an extension. This is what the "Get Extension Key"
// button on the registry site calls. Returns { key }.
import { generateKey } from "../../_lib/keys.js";
import { findExtension } from "../../_lib/catalog.js";

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

  const { extensionId, version } = req.body || {};

  if (!extensionId) {
    res.status(400).json({ error: "extensionId is required." });
    return;
  }

  if (!findExtension(extensionId)) {
    res.status(404).json({ error: `Extension not found: ${extensionId}` });
    return;
  }

  try {
    const key = generateKey(extensionId, version);
    res.status(200).json({ key });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
