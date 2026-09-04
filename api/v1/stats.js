// GET /api/v1/stats
// Returns registry statistics for the site header.
import { getPublicExtensionList } from "../_lib/catalog.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const extensions = getPublicExtensionList();
  res.status(200).json({
    totalExtensions: extensions.length,
    totalDownloads: extensions.reduce((sum, e) => sum + (e.downloads || 0), 0),
    registeredDevelopers: 1,
  });
}
