import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const exactSemver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const invalid = [];

for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
  for (const [name, version] of Object.entries(packageJson[field] ?? {})) {
    if (!exactSemver.test(version)) invalid.push(`${field}.${name}=${version}`);
  }
}

if (invalid.length > 0) {
  throw new Error(`Unpinned package versions are forbidden:\n${invalid.join("\n")}`);
}

console.log("Dependency version pins verified.");
