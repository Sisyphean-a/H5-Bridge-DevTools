import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    // 由 scripts/build.mjs 在启动时统一清空 dist：
    // 若让 vite 在 watch 模式下执行 emptyOutDir，会删掉并发写入的
    // esbuild 产物（background/content/injected），产生损坏的扩展产物。
    emptyOutDir: false,
    modulePreload: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, "devtools.html"),
        panel: resolve(__dirname, "panel.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
