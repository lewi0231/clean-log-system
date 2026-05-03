/**
 * S1 Phase 4 — reconcile functions-inventory.yaml with filesystem + guard `secured` imports.
 *
 * Run from repo root:
 *   pnpm validate:functions-inventory
 */

import { parse } from "@std/yaml";
import { dirname, fromFileUrl, join } from "@std/path";

const FUNCTIONS_ROOT = join(dirname(fromFileUrl(import.meta.url)), "..");
const INVENTORY_PATH = join(FUNCTIONS_ROOT, "functions-inventory.yaml");

const ALLOWED_CLASSES = new Set([
  "public",
  "identity",
  "privileged_batch",
  "alternate_auth",
  "secured",
  "secured_custom",
]);

/** Shared org gate symbols — `secured` entries must reference at least one. */
const SECURED_IMPORT_PATTERN =
  /(?:verifyOrganizationMembership(?:FromRequest)?|requireAuthenticatedOrgMember|gateOrganizationRequest|requireOrgAdminFromRequest|serveJsonHandler)/;

interface InventoryFile {
  version?: number;
  functions?: Record<string, string>;
}

async function discoverFunctionsOnDisk(): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_ROOT)) {
    if (!entry.isDirectory || entry.name.startsWith("_")) continue;
    const indexPath = join(FUNCTIONS_ROOT, entry.name, "index.ts");
    try {
      await Deno.stat(indexPath);
      names.push(entry.name);
    } catch {
      // Directory exists but has no index.ts — not an Edge Function entrypoint
    }
  }
  return names.sort();
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

async function main(): Promise<void> {
  let inventoryRaw: string;
  try {
    inventoryRaw = await Deno.readTextFile(INVENTORY_PATH);
  } catch (err) {
    throw new ValidationError(
      `Cannot read inventory file: ${INVENTORY_PATH}\n${err instanceof Error ? err.message : String(err)}`
    );
  }

  const parsed = parse(inventoryRaw) as InventoryFile;
  const map = parsed.functions;

  if (!map || typeof map !== "object") {
    throw new ValidationError(
      `Invalid inventory: missing top-level "functions" map in ${INVENTORY_PATH}`
    );
  }

  const disk = new Set(await discoverFunctionsOnDisk());
  const yamlKeys = new Set(Object.keys(map));

  // Check for functions on disk not in inventory
  const orphansOnDisk = [...disk].filter((n) => !yamlKeys.has(n));
  if (orphansOnDisk.length > 0) {
    throw new ValidationError(
      `Inventory missing ${orphansOnDisk.length} function(s) (add rows to functions-inventory.yaml):\n` +
        orphansOnDisk.map((n) => `  - ${n}`).join("\n")
    );
  }

  // Check for inventory entries that no longer exist
  const staleYaml = [...yamlKeys].filter((n) => !disk.has(n));
  if (staleYaml.length > 0) {
    throw new ValidationError(
      `Inventory lists removed or renamed function(s):\n` +
        staleYaml.map((n) => `  - ${n}`).join("\n")
    );
  }

  // Validate classification values
  const wrongClass: string[] = [];
  for (const [fn, cls] of Object.entries(map)) {
    if (typeof cls !== "string" || !ALLOWED_CLASSES.has(cls)) {
      wrongClass.push(`${fn}: invalid class "${cls}"`);
    }
  }
  if (wrongClass.length > 0) {
    throw new ValidationError(`Invalid classification(s):\n${wrongClass.join("\n")}`);
  }

  // Verify `secured` entries import a shared org gate
  const missingPattern: string[] = [];
  for (const [fn, cls] of Object.entries(map)) {
    if (cls !== "secured") continue;
    const path = join(FUNCTIONS_ROOT, fn, "index.ts");
    const src = await Deno.readTextFile(path);
    if (!SECURED_IMPORT_PATTERN.test(src)) {
      missingPattern.push(fn);
    }
  }
  if (missingPattern.length > 0) {
    throw new ValidationError(
      `Functions classified "secured" must import a shared org gate ` +
        `(verifyOrganizationMembership*, requireAuthenticatedOrgMember, gateOrganizationRequest, requireOrgAdminFromRequest, serveJsonHandler):\n` +
        missingPattern.map((n) => `  - ${n}`).join("\n")
    );
  }

  const securedCount = Object.values(map).filter((c) => c === "secured").length;
  console.log(
    `OK — ${disk.size} Edge Functions reconciled; ${securedCount} secured (import check passed).`
  );
}

try {
  await main();
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(err.message);
  } else {
    console.error("Unexpected error:", err);
  }
  Deno.exit(1);
}
