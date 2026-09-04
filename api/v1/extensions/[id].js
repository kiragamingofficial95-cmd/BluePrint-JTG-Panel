// GET /api/v1/extensions/[id]
// Returns detailed info for a single extension.
import { getPublicExtensionDetail } from "../_lib/catalog.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { id } = req.query;
  const detail = getPublicExtensionDetail(id);

  if (!detail) {
    res.status(404).json({ error: "Extension not found." });
    return;
  }

  res.status(200).json(detail);
}
