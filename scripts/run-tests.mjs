import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, parse, relative, resolve } from "node:path";
import { build } from "esbuild";

function discoverTestFiles(directoryPath) {
  const discovered = [];
  const entries = readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...discoverTestFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      discovered.push(entryPath);
    }
  }

  return discovered;
}

function discoverServerTestFiles(directoryPath) {
  const discovered = [];
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...discoverServerTestFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      discovered.push(entryPath);
    }
  }
  return discovered;
}

const projectRoot = resolve(".");
const sourceRoot = resolve("src");
const serverRoot = resolve("server");
const temporaryDirectory = mkdtempSync(join(projectRoot, ".tests-bundle-"));

try {
  const testFiles = discoverTestFiles(sourceRoot).sort((left, right) =>
    left.localeCompare(right),
  );
  if (testFiles.length === 0) {
    throw new Error("No test files found under src/**/*.test.ts.");
  }

  await build({
    entryPoints: testFiles,
    outdir: temporaryDirectory,
    outbase: sourceRoot,
    entryNames: "[dir]/[name]",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: "inline",
  });

  const bundledOutputs = testFiles
    .map((entryPoint) => {
      const relativeToSource = relative(sourceRoot, entryPoint);
      const parsed = parse(relativeToSource);
      return join(temporaryDirectory, parsed.dir, `${parsed.name}.js`);
    })
    .sort((left, right) => left.localeCompare(right));
  const serverTests = existsSync(serverRoot)
    ? discoverServerTestFiles(serverRoot).sort((left, right) =>
        left.localeCompare(right),
      )
    : [];

  const result = spawnSync(
    process.execPath,
    ["--test", ...bundledOutputs, ...serverTests],
    {
    stdio: "inherit",
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
