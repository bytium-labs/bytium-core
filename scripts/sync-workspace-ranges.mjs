// Rewrites every @bytium-core/* dependency range across the workspace to match the current
// version (read from the workspace root). Run after `npm version` so a major bump does not leave
// sibling peer ranges pointing at the previous major.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const files = ["package.json", ...readdirSync("packages").map((dir) => `packages/${dir}/package.json`)].filter(
  existsSync,
);

for (const file of files) {
  const pkg = JSON.parse(readFileSync(file, "utf8"));

  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[field];

    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      if (name.startsWith("@bytium-core/")) deps[name] = `^${version}`;
    }
  }

  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}

console.log(`Synced @bytium-core/* ranges to ^${version}.`);
