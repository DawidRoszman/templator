import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const distDir = join(root, "dist");
const baseName = "mail-templates";

mkdirSync(distDir, { recursive: true });

const entries = [
  "manifest.json",
  "background.js",
  "LICENSE",
  "shared",
  "popup",
  "options",
];

const outVersioned = join(distDir, `${baseName}-${version}.xpi`);
const outLatest = join(distDir, `${baseName}.xpi`);

function zipTo(outPath) {
  execFileSync("zip", ["-r", "-q", outPath, ...entries], { cwd: root });
}

zipTo(outVersioned);
writeFileSync(outLatest, readFileSync(outVersioned));

console.log(`Built ${outVersioned}`);
console.log(`Copied to ${outLatest} (stable name for releases)`);
