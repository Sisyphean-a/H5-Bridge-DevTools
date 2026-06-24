import { useRef, type ChangeEvent } from "react";
import type { ToolbarProps } from "../types";
import { panelTheme } from "../designSystem";

const tabs = [
  { id: "rules", label: "规则" },
  { id: "logs", label: "日志" },
  { id: "manual", label: "手动发送" },
  { id: "settings", label: "设置" },
] as const;

export function Toolbar({
  snapshot,
  importStrategy,
  isWide,
  onToggleGlobal,
  onClearLogs,
  onExportRules,
  onImportRules,
  onImportStrategyChange,
  onTabChange,
  activeTab,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    onImportRules(await file.text());
    event.target.value = "";
  }

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        borderBottom: `1px solid ${panelTheme.border}`,
        background: panelTheme.toolbar,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingRight: 8,
            marginRight: 8,
            borderRight: `1px solid ${panelTheme.border}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              background: panelTheme.blue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 7,
              fontWeight: 700,
            }}
          >
            H5
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: panelTheme.text }}>
            {isWide ? "H5 桥接调试工具" : "桥接"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            paddingRight: 8,
            marginRight: 8,
            borderRight: `1px solid ${panelTheme.border}`,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => onToggleGlobal(!(snapshot?.globalEnabled ?? false))}
            style={{
              width: 24,
              height: 14,
              borderRadius: 99,
              border: "none",
              background: snapshot?.globalEnabled
                ? panelTheme.switchOn
                : panelTheme.switchOff,
              position: "relative",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: snapshot?.globalEnabled ? 12 : 2,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.12s",
                boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
              }}
            />
          </button>
          <span
            style={{
              fontSize: 11,
              color: snapshot?.globalEnabled ? panelTheme.blue : panelTheme.textDisabled,
              fontWeight: snapshot?.globalEnabled ? 600 : 400,
            }}
          >
            {snapshot?.globalEnabled ? "模拟开启" : "模拟关闭"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingRight: 8,
            marginRight: 8,
            borderRight: `1px solid ${panelTheme.border}`,
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 18,
              height: 16,
              padding: "0 5px",
              background: panelTheme.blueBg,
              color: panelTheme.blue,
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {snapshot?.rules.length ?? 0}
          </span>
          <span style={{ fontSize: 11, color: panelTheme.textSecondary }}>
            条规则
          </span>
          {isWide ? (
            <span
              style={{
                fontSize: 11,
                color: panelTheme.textSecondary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {snapshot?.origin ?? "连接中"}
            </span>
          ) : null}
        </div>

        <div style={{ flex: 1 }} />

        <select
          value={importStrategy}
          onChange={(event) => onImportStrategyChange(event.target.value as typeof importStrategy)}
          style={{
            height: 24,
            border: `1px solid ${panelTheme.border}`,
            background: panelTheme.panel,
            color: panelTheme.text,
            borderRadius: 2,
            fontSize: 11,
          }}
        >
          <option value="merge">导入：合并</option>
          <option value="replace">导入：替换</option>
          <option value="appendDisabled">导入：追加为禁用</option>
        </select>
        <ToolbarButton label="导入" onClick={() => fileRef.current?.click()} />
        <ToolbarButton label="导出" onClick={onExportRules} />
        <ToolbarButton label="清空日志" onClick={onClearLogs} danger />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          height: 30,
          padding: "0 4px",
          borderTop: `1px solid ${panelTheme.border}`,
        }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              style={{
                height: "100%",
                padding: "0 10px",
                border: "none",
                borderBottom: active
                  ? `2px solid ${panelTheme.blue}`
                  : "2px solid transparent",
                background: active ? panelTheme.panel : "transparent",
                color: active ? panelTheme.blue : panelTheme.textSecondary,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        hidden
        type="file"
        accept="application/json"
        onChange={handleFileChange}
      />
    </header>
  );
}

function ToolbarButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 24,
        padding: "0 8px",
        border: "none",
        borderRadius: 2,
        background: "transparent",
        color: danger ? panelTheme.red : panelTheme.textSecondary,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
