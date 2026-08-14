import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWatch = process.argv.includes("--watch");
const require = createRequire(import.meta.url);
const vitePackageJson = require.resolve("vite/package.json");
const viteBinary = resolve(dirname(vitePackageJson), "bin", "vite.js");

const distManifestPath = resolve(root, "dist/manifest.json");
const manifestTemplatePath = resolve(root, "public/manifest.json");

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

// 清空 dist 必须在任何构建开始之前完成：vite 的 emptyOutDir 已关闭，
// 清理由这里统一执行，避免 vite 删除并发写入的 esbuild 产物。
await rm(resolve(root, "dist"), { recursive: true, force: true });

if (isWatch) {
  const viteProcess = spawnVite(["build", "--watch"]);
  const contexts = await Promise.all(scriptEntries.map(createContext));
  await Promise.all(contexts.map((item) => item.watch()));
  const injectTimer = startManifestInjectionLoop();

  const shutdown = async () => {
    clearInterval(injectTimer);
    await Promise.all(contexts.map((item) => item.dispose()));
    viteProcess.kill("SIGINT");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} else {
  await runViteBuild();
  await Promise.all(scriptEntries.map(buildEntry));
  await injectManifestMatches();
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

/**
 * host_permissions 是唯一站点来源；content_scripts 的 matches 从它生成，
 * 避免同一份站点清单在 manifest 里维护三份。
 * watch 模式下 vite 重拷贝 public/manifest.json 后会重新注入。
 */
async function injectManifestMatches() {
  const template = JSON.parse(await readFile(manifestTemplatePath, "utf8"));
  const hosts = Array.isArray(template.host_permissions) ? template.host_permissions : [];
  const manifest = JSON.parse(await readFile(distManifestPath, "utf8"));
  const nextManifest = {
    ...manifest,
    content_scripts: (manifest.content_scripts ?? []).map((script) => ({
      ...script,
      matches: [...hosts],
    })),
  };
  await writeFile(distManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
}

function startManifestInjectionLoop() {
  return setInterval(() => {
    injectManifestMatches().catch(() => {
      // vite 尚未产出 manifest，下一轮再试
    });
  }, 1000);
}
