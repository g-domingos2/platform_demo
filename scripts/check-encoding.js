const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
]);
const IGNORED_DIRS = new Set([".git", "node_modules", "brain"]);

const checks = [
  { name: "UTF-8 BOM", regex: /\uFEFF/u },
  { name: "replacement character", regex: /\uFFFD/u },
  { name: "C1 control character", regex: /[\u0080-\u009F]/u },
  { name: "soft hyphen", regex: /\u00AD/u },
  {
    name: "UTF-8 text decoded as Latin-1/Windows-1252",
    regex: /(?:\u00C3[\u00A0-\u00BF]|\u00C3\u0192|\u00C2[\u00A0-\u00BF]|\u00E2[\u0080-\u00BF]|\u00E2\u20AC|\u00C3\u00AF\u00C2\u00BB\u00C2\u00BF|\u00C3\u00AF\u00C2\u00B8)/u,
  },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function excerpt(line) {
  return line.replace(/\t/g, "\\t").slice(0, 180);
}

let failures = 0;
for (const filePath of walk(ROOT)) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    failures += 1;
    console.error(`${path.relative(ROOT, filePath)}: cannot read as UTF-8 (${error.message})`);
    continue;
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const hit = checks.find((check) => check.regex.test(line));
    if (!hit) return;
    failures += 1;
    console.error(`${path.relative(ROOT, filePath)}:${index + 1}: ${hit.name}: ${excerpt(line)}`);
  });
}

if (failures) {
  console.error(`\nEncoding check failed with ${failures} issue(s). Save source files as UTF-8 and remove mojibake before committing.`);
  process.exit(1);
}

console.log("Encoding check passed: UTF-8 text has no mojibake markers.");

