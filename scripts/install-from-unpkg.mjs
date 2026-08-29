import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const projectRoot = process.env.UNPKG_INSTALL_ROOT
  ? resolve(process.env.UNPKG_INSTALL_ROOT)
  : resolve(import.meta.dirname, "..");
const modulesRoot = join(projectRoot, "node_modules");
const manifest = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8"),
);
const installed = new Map();
const skipped = new Set();
const lockPath = join(projectRoot, "unpkg-lock.json");
const existingLock =
  process.env.UNPKG_IGNORE_LOCK !== "1" && existsSync(lockPath)
  ? JSON.parse(readFileSync(lockPath, "utf8"))
  : { packages: {} };

function packageUrl(name, versionOrRange, path = "") {
  const version = encodeURIComponent(versionOrRange);
  return `https://unpkg.com/${name}@${version}${path}`;
}

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, attempt * 750),
        );
      }
    }
  }
  throw new Error(`下载失败：${url}\n${lastError}`);
}

function matchesConstraint(values, current) {
  if (!Array.isArray(values) || values.length === 0) return true;
  if (values.includes(`!${current}`)) return false;
  const positives = values.filter((value) => !value.startsWith("!"));
  return positives.length === 0 || positives.includes(current);
}

function isCompatible(packageManifest) {
  return (
    matchesConstraint(packageManifest.os, process.platform) &&
    matchesConstraint(packageManifest.cpu, process.arch)
  );
}

function digest(buffer) {
  return `sha256-${createHash("sha256").update(buffer).digest("base64")}`;
}

async function mapLimit(items, limit, callback) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await callback(items[index], index);
      }
    },
  );
  await Promise.all(workers);
}

async function resolveManifest(name, range) {
  const lockedVersion = existingLock.packages?.[name]?.version;
  const requestedVersion = lockedVersion ?? range;
  const response = await fetchWithRetry(
    packageUrl(name, requestedVersion, "/package.json"),
  );
  return response.json();
}

async function downloadPackage(name, packageManifest) {
  const version = packageManifest.version;
  const metadataResponse = await fetchWithRetry(
    packageUrl(name, version, "/?meta"),
  );
  const metadata = await metadataResponse.json();
  const packageRoot = join(modulesRoot, ...name.split("/"));
  let downloaded = 0;

  await mapLimit(metadata.files, 8, async (file) => {
    const relativePath = file.path.replace(/^\/+/, "");
    const target = join(packageRoot, ...relativePath.split("/"));

    if (existsSync(target)) {
      const current = readFileSync(target);
      if (digest(current) === file.integrity) return;
    }

    const response = await fetchWithRetry(
      packageUrl(name, version, file.path),
    );
    const content = Buffer.from(await response.arrayBuffer());
    const actualIntegrity = digest(content);
    if (actualIntegrity !== file.integrity) {
      throw new Error(
        `${name}@${version}${file.path} 完整性校验失败：${actualIntegrity}`,
      );
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    downloaded += 1;
  });

  console.log(
    `installed ${name}@${version} (${metadata.files.length} files, ${downloaded} downloaded)`,
  );
  return {
    version,
    files: metadata.files.length,
    manifestIntegrity:
      metadata.files.find((file) => file.path === "/package.json")?.integrity ??
      null,
  };
}

async function installPackage(name, range, optional = false) {
  if (installed.has(name) || skipped.has(name)) return;
  installed.set(name, { pending: true });

  let packageManifest;
  try {
    packageManifest = await resolveManifest(name, range);
  } catch (error) {
    installed.delete(name);
    if (optional) {
      skipped.add(name);
      return;
    }
    throw error;
  }

  if (!isCompatible(packageManifest)) {
    installed.delete(name);
    skipped.add(name);
    return;
  }

  const lockRecord = await downloadPackage(name, packageManifest);
  installed.set(name, { manifest: packageManifest, lockRecord });

  for (const [dependencyName, dependencyRange] of Object.entries(
    packageManifest.dependencies ?? {},
  )) {
    await installPackage(dependencyName, dependencyRange);
  }

  for (const [dependencyName, dependencyRange] of Object.entries(
    packageManifest.optionalDependencies ?? {},
  )) {
    await installPackage(dependencyName, dependencyRange, true);
  }
}

function createBinaryWrappers() {
  const binaryDirectory = join(modulesRoot, ".bin");
  mkdirSync(binaryDirectory, { recursive: true });

  for (const [name, record] of installed) {
    const binaries = record.manifest?.bin;
    if (!binaries) continue;
    const entries =
      typeof binaries === "string"
        ? [[name.split("/").at(-1), binaries]]
        : Object.entries(binaries);

    for (const [binaryName, binaryPath] of entries) {
      const target = join(modulesRoot, ...name.split("/"), binaryPath);
      const targetFromBin = relative(binaryDirectory, target);
      const windowsTarget = targetFromBin.split(sep).join("\\");
      writeFileSync(
        join(binaryDirectory, `${binaryName}.cmd`),
        `@ECHO OFF\r\nnode "%~dp0\\${windowsTarget}" %*\r\n`,
      );
      const shellTarget = targetFromBin.split(sep).join("/");
      const shellWrapper = join(binaryDirectory, binaryName);
      writeFileSync(
        shellWrapper,
        `#!/bin/sh\nexec node "$(dirname "$0")/${shellTarget}" "$@"\n`,
      );
      chmodSync(shellWrapper, 0o755);
    }
  }
}

mkdirSync(modulesRoot, { recursive: true });
const rootDependencies = {
  ...manifest.dependencies,
  ...manifest.devDependencies,
};

for (const [name, range] of Object.entries(rootDependencies)) {
  await installPackage(name, range);
}

createBinaryWrappers();

const packages = Object.fromEntries(
  [...installed.entries()]
    .filter(([, record]) => record.lockRecord)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, record]) => [name, record.lockRecord]),
);
writeFileSync(
  lockPath,
  `${JSON.stringify(
    {
      source: "https://unpkg.com",
      integrity: "sha256-per-file",
      packages,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `ready: ${Object.keys(packages).length} packages installed, ${skipped.size} incompatible optional packages skipped`,
);
