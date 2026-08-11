# 注意事项

- 本仓库是单包 Chrome Manifest V3 DevTools 扩展；改动公开入口或权限时，同步核对 `public/manifest.json` 与 `scripts/build.mjs`。
- 开始任务按范围读取：本文件 → `architecture/INDEX.md` → `architecture/packages/h5-bridge-devtools.md` → `requirements/CONTEXT.md` → `requirements/contexts/bridge-simulation.md`；只有追问取舍时再读 ADR 或历史。
- 交付前优先运行 `npm run typecheck`、`npm run test`、`npm run build`。涉及真实扩展交互或图片写入时再运行 `npm run test:e2e`（脚本启动有界面 Chromium）。
- 规则与日志以 Chrome 本地存储为准；不要用长期 background port 或内存映射作为跨页面状态来源。
