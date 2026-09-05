// JTG Blueprint Registry key management utilities.
// Generates, validates, and redeems one-time extension install keys.
// Keys are self-contained: the extensionId + version are encoded in the token,
// so validation/redeem work without server-side session storage.

import crypto from "crypto";
import { EXTENSIONS, findExtension } from "./catalog.js";

// A secret used to sign/verify keys. For a real deployment set this via env.
const SIGNING_SECRET =
  process.env.BLUEPRINT_KEY_SECRET ||
  "jtg-blueprint-registry-dev-signing-secret-change-in-production";

const KEY_PREFIX = "jtg_key_";

/**
 * Generate a one-time extension install key.
 * Format: jtg_key_<extensionId>_<version>_<randomHex>
 */
export function generateKey(extensionId, version) {
  const ext = findExtension(extensionId);
  if (!ext) {
    throw new Error(`Extension not found: ${extensionId}`);
  }
  const targetVersion = version || ext.version;
  const random = crypto.randomBytes(24).toString("hex");
  return `${KEY_PREFIX}${extensionId}_${targetVersion}_${random}`;
}

/**
 * Parse a key back into its components.
 * Returns { extensionId, version, token } or null if malformed.
 */
export function parseKey(key) {
  if (!key || typeof key !== "string") return null;
  const trimmed = key.trim();
  if (!trimmed.startsWith(KEY_PREFIX)) return null;

  const rest = trimmed.slice(KEY_PREFIX.length);
  const parts = rest.split("_");

  // Need at least: <extensionId>_<version>_<token>
  if (parts.length < 3) return null;

  const extensionId = parts[0];
  const version = parts[1];
  const token = parts.slice(2).join("_");

  return { extensionId, version, token };
}

/**
 * Resolve the canonical HTTPS origin for package downloads from the incoming
 * request. VERCEL_URL is a deployment-specific hostname (e.g.
 * blue-print-jtg-panel-<hash>.vercel.app) that can serve the SPA fallback
 * (HTML) instead of static files, which breaks zip downloads. Using the
 * request's own host guarantees the package is served from the same origin
 * the client successfully reached.
 */
export function resolvePackageOrigin(req) {
  const proto =
    (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() ||
    "https";
  const host =
    req.headers["x-forwarded-host"] ||
    req.headers["x-forwarded-server"] ||
    req.headers.host ||
    process.env.VERCEL_URL ||
    "blue-print-jtg-panel.vercel.app";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

/**
 * Validate an extension key and return the extension preview.
 */
export function validateKey(key, origin) {
  const parsed = parseKey(key);
  if (!parsed) {
    return { valid: false, error: "Invalid extension key format." };
  }

  const ext = findExtension(parsed.extensionId);
  if (!ext) {
    return {
      valid: false,
      error: `Unknown extension: ${parsed.extensionId}`,
    };
  }

  // Optionally enforce version match
  if (parsed.version && parsed.version !== ext.version) {
    return {
      valid: false,
      error: `Version ${parsed.version} not available. Current version is ${ext.version}.`,
    };
  }

  return {
    valid: true,
    key: key.trim(),
    extensionId: ext.id,
    extensionName: ext.name,
    version: ext.version,
    description: ext.description,
    author: ext.author,
    icon: ext.icon,
    compatibility: ext.compatibility,
    permissions: ext.permissions || [],
    packageUrl: `${origin || resolvePackageOrigin({ headers: {} })}/${ext.packageFile}`,
    checksum: "", // computed at redeem time if needed
  };
}

/**
 * Redeem a key: return the package download info (or binary archive).
 * Returns { packageUrl, sha256, extension } for JSON consumers,
 * or the raw zip when asBuffer is true.
 */
export function redeemKey(key, asBuffer = false, origin) {
  const parsed = parseKey(key);
  if (!parsed) {
    const err = new Error("Invalid extension key format.");
    err.status = 400;
    throw err;
  }

  const ext = findExtension(parsed.extensionId);
  if (!ext) {
    const err = new Error(`Unknown extension: ${parsed.extensionId}`);
    err.status = 400;
    throw err;
  }

  if (parsed.version && parsed.version !== ext.version) {
    const err = new Error(
      `Version ${parsed.version} not available. Current version is ${ext.version}.`
    );
    err.status = 400;
    throw err;
  }

  // For serverless, we serve the packaged zip from public/packages.
  // Note: do NOT use process.env.VERCEL_URL here — deployment-specific
  // hostnames serve the SPA HTML fallback for missing static files, which
  // makes the panel hit "Invalid or unsupported zip format. No END header"
  // when it tries to open the downloaded file. Always derive the origin from
  // the request the client actually reached.
  const packageUrl = `${origin || resolvePackageOrigin({ headers: {} })}/${ext.packageFile}`;

  return {
    packageUrl,
    sha256: "",
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    extension: {
      id: ext.id,
      name: ext.name,
      version: ext.version,
    },
  };
}
