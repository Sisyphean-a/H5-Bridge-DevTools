import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWatch = process.argv.includes("--watch");
const require = createRequire(import.meta.url);
const vitePackageJson = require.resolve("vite/package.json");
const viteBinary = resolve(dirname(vitePackageJson), "bin", "vite.js");

const scriptEntries = [
  {
    entry: resolve(root, "src/background/serviceWorker.ts"),
    outfile: resolve(root, "dist/background/serviceWorker.js"),
    format: "esm",
  },
  {
    entry: resolve(root, "src/content/contentScript.ts"),
    outfile: resolve(root, "dist/content/contentScript.js"),
    format: "iife",
  },
  {
    entry: resolve(root, "src/injected/injectMain.ts"),
    outfile: resolve(root, "dist/injected/injectMain.js"),
    format: "iife",
  },
];

if (isWatch) {
  const viteProcess = spawnVite(["build", "--watch"]);
  const contexts = await Promise.all(scriptEntries.map(createContext));
  await Promise.all(contexts.map((item) => item.watch()));

  const shutdown = async () => {
    await Promise.all(contexts.map((item) => item.dispose()));
    viteProcess.kill("SIGINT");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} else {
  await runViteBuild();
  await Promise.all(scriptEntries.map(buildEntry));
}

async function runViteBuild() {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawnVite(["build"]);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }
      rejectPromise(new Error(`Vite build failed with exit code ${code ?? "unknown"}.`));
    });
    child.on("error", rejectPromise);
  });
}

function spawnVite(args) {
  return spawn(process.execPath, [viteBinary, ...args], {
    cwd: root,
    stdio: "inherit",
  });
}

function buildEntry(entry) {
  return build(createBuildOptions(entry));
}

function createContext(entry) {
  return context(createBuildOptions(entry));
}

function createBuildOptions(entry) {
  return {
    bundle: true,
    entryPoints: [entry.entry],
    format: entry.format,
    outfile: entry.outfile,
    platform: "browser",
    target: "chrome120",
    sourcemap: true,
  };
}
