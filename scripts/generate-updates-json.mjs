import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) {
  console.warn("GITHUB_REPOSITORY not set; skipping updates.json");
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const extensionId = manifest.browser_specific_settings?.gecko?.id;
const minVersion = manifest.browser_specific_settings?.gecko?.strict_min_version;

if (!extensionId) {
  console.error("manifest.json missing browser_specific_settings.gecko.id");
  process.exit(1);
}

const xpiPath = join(root, "dist", "mail-templates.xpi");
const xpi = readFileSync(xpiPath);
const hash = createHash("sha256").update(xpi).digest("hex");

const tag = `v${version}`;
const updateLink = `https://github.com/${repo}/releases/download/${tag}/mail-templates.xpi`;

const payload = {
  addons: {
    [extensionId]: {
      updates: [
        {
          version,
          update_link: updateLink,
          update_hash: `sha256:${hash}`,
          applications: {
            gecko: {
              strict_min_version: minVersion || "115.0",
            },
          },
        },
      ],
    },
  },
};

const outPath = join(root, "dist", "updates.json");
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
