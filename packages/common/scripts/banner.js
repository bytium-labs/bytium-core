const fs = require("fs");
const path = require("path");

// Prepends a `/*!` legal banner to the built entries. Terser keeps legal comments even with `comments: false`,
// so it survives minification into every resource that bundles bytium-core (the same way tslib's banner does).
const { version } = require(path.join(__dirname, "../package.json"));
const banner = `/*! bytium-core v${version} © 2026 lilabyte — bytium.dev */\n`;

for (const entry of ["dist/index.js", "dist/client.js", "dist/server.js"]) {
  const target = path.join(__dirname, "..", entry);

  if (!fs.existsSync(target)) continue;

  const content = fs.readFileSync(target, "utf8");

  if (!content.startsWith("/*! bytium-core")) {
    fs.writeFileSync(target, banner + content);
  }
}
