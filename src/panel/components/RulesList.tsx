import { panelTheme } from "../designSystem";
import type { RulesListProps } from "../types";

export function RulesList({
  rules,
  selectedRuleId,
  filterText,
  presetRules,
  enabledCount,
  onFilterChange,
  onSelect,
  onAddBlank,
  onAddFromPreset,
  onToggle,
}: RulesListProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: panelTheme.panel,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          height: 36,
          borderBottom: `1px solid ${panelTheme.border}`,
          background: panelTheme.toolbar,
          flexShrink: 0,
        }}
      >
        <input
          value={filterText}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="搜索规则..."
          style={searchInputStyle}
        />
        <button type="button" onClick={onAddBlank} style={primaryButtonStyle}>
          添加
        </button>
        <select
          defaultValue=""
          onChange={(event) => {
            const presetId = event.target.value;
            if (!presetId) {
              return;
            }
            onAddFromPreset(presetId);
            event.target.value = "";
          }}
          style={selectStyle}
        >
          <option value="">模板</option>
          {presetRules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {rules.length === 0 ? (
          <EmptyHint title="暂无规则" subtitle="添加规则以开始模拟桥接调用" />
        ) : (
          rules.map((rule) => {
            const selected = selectedRuleId === rule.id;
            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => onSelect(rule.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  width: "100%",
                  height: 38,
                  padding: "0 8px",
                  border: "none",
                  borderLeft: selected
                    ? `2px solid ${panelTheme.blue}`
                    : "2px solid transparent",
                  background: selected ? panelTheme.rowSelected : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <ToggleSwitch
                  checked={rule.enabled}
                  onChange={(enabled) => onToggle(rule.id, enabled)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: rule.enabled ? 500 : 400,
                      color: rule.enabled ? panelTheme.text : panelTheme.textDisabled,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rule.name}
                  </div>
                  <div
                    style={{
                      marginTop: 1,
                      fontSize: 11,
                      fontFamily: panelTheme.mono,
                      color: panelTheme.textSecondary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rule.match.event || "(空事件)"}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  {rule.response.delayMs > 0 ? (
                    <span style={delayBadgeStyle}>{rule.response.delayMs}ms</span>
                  ) : null}
                  {(rule.meta?.hitCount ?? 0) > 0 ? (
                    <span style={countBadgeStyle}>{rule.meta?.hitCount ?? 0}</span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div
        style={{
          padding: "3px 8px",
          borderTop: `1px solid ${panelTheme.border}`,
          background: panelTheme.toolbar,
          fontSize: 11,
          color: panelTheme.textSecondary,
          display: "flex",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span>{enabledCount} 条已启用</span>
        <span style={{ color: panelTheme.textDisabled }}>·</span>
        <span>共 {rules.length} 条</span>
      </div>
    </section>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      style={{
        width: 24,
        height: 14,
        borderRadius: 99,
        border: "none",
        background: checked ? panelTheme.switchOn : panelTheme.switchOff,
        position: "relative",
        flexShrink: 0,
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 12 : 2,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.12s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        }}
      />
    </button>
  );
}

function EmptyHint({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "24px 16px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: panelTheme.textSecondary }}>
        {title}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: panelTheme.textDisabled }}>
        {subtitle}
      </div>
    </div>
  );
}

const searchInputStyle = {
  flex: 1,
  height: 24,
  padding: "0 6px",
  fontSize: 12,
  fontFamily: panelTheme.sans,
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: panelTheme.panel,
  color: panelTheme.text,
  outline: "none",
} as const;

const primaryButtonStyle = {
  height: 24,
  padding: "0 8px",
  border: "none",
  borderRadius: 2,
  background: panelTheme.blue,
  color: "#fff",
  fontSize: 12,
  cursor: "pointer",
} as const;

const selectStyle = {
  height: 24,
  padding: "0 6px",
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: panelTheme.panel,
  color: panelTheme.text,
  fontSize: 12,
} as const;

const delayBadgeStyle = {
  fontSize: 10,
  fontFamily: panelTheme.mono,
  color: panelTheme.orange,
  background: panelTheme.orangeBg,
  padding: "1px 4px",
  borderRadius: 2,
} as const;

const countBadgeStyle = {
  minWidth: 20,
  height: 16,
  padding: "0 4px",
  borderRadius: 10,
  border: `1px solid ${panelTheme.border}`,
  background: panelTheme.bg,
  color: panelTheme.textSecondary,
  fontSize: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} as const;
