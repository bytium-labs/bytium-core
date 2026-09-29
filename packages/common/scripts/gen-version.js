const fs = require("fs");
const path = require("path");

// Keeps BYTIUM_VERSION in sync with package.json so the version is a single source of truth.
const { version } = require(path.join(__dirname, "../package.json"));

fs.writeFileSync(path.join(__dirname, "../src/core/version.ts"), `export const BYTIUM_VERSION = "${version}";\n`);
