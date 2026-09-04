// POST /api/v1/keys/redeem
// Redeems a one-time install key and returns the package download info.
// This is called by the JTG Panel after validating a key.
// Expected request: { key: "jtg_key_..." }
// Expected response: { packageUrl, sha256, expires }
import { redeemKey } from "../_lib/keys.js";

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

  try {
    const result = redeemKey(key);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}
