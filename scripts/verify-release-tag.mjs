import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const ref = process.env.GITHUB_REF_NAME || "";
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const version = manifest.version;

const tagVersion = ref.startsWith("v") ? ref.slice(1) : ref;

if (!tagVersion || tagVersion !== version) {
  console.error(
    `Tag "${ref}" must match manifest version "${version}". Bump manifest.json, commit, then tag v${version}.`,
  );
  process.exit(1);
}

console.log(`Tag v${tagVersion} matches manifest version ${version}.`);
