// GET /api/v1/extensions
// Returns the list of published extensions for the registry site.
import { getPublicExtensionList } from "../_lib/catalog.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  res.status(200).json(getPublicExtensionList());
}
