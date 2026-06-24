import type { CSSProperties, ReactNode } from "react";
import type { OriginBridgeSettings } from "../../shared/ruleTypes";
import { panelTheme } from "../designSystem";

interface SettingsPanelProps {
  settings: OriginBridgeSettings | null;
  onChange: (settings: Partial<OriginBridgeSettings>) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  if (!settings) {
    return (
      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: panelTheme.panel,
          color: panelTheme.textDisabled,
        }}
      >
        等待当前页面设置加载
      </section>
    );
  }

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: panelTheme.panel,
      }}
    >
      <div style={{ flex: 1, overflowY: "auto" }}>
        <SectionTitle>拦截设置</SectionTitle>
        <SettingRow
          label="自动模拟"
          description="启用后，匹配的桥接请求会自动返回规则中的响应。"
          control={
            <ToggleSwitch
              checked={settings.autoMock}
              onChange={(checked) => onChange({ autoMock: checked })}
            />
          }
        />
        <SettingRow
          label="覆盖 AndroidBridge"
          description="若页面已注入同名对象，则强制覆盖。原生环境已注入时应谨慎开启。"
          control={
            <ToggleSwitch
              checked={settings.overrideExistingAndroidBridge}
              onChange={(checked) =>
                onChange({ overrideExistingAndroidBridge: checked })
              }
            />
          }
        />

        <SectionTitle>日志设置</SectionTitle>
        <SettingRow
          label="保留日志"
          description="刷新快照或规则变化时继续保留已记录的桥接日志。"
          control={
            <ToggleSwitch
              checked={settings.preserveLogs}
              onChange={(checked) => onChange({ preserveLogs: checked })}
            />
          }
        />
        <SettingRow
          label="日志上限"
          description="超过上限后，将自动丢弃最早的日志。"
          control={
            <input
              type="number"
              min={1}
              value={settings.maxLogCount}
              onChange={(event) =>
                onChange({ maxLogCount: Math.max(1, Number(event.target.value || 1)) })
              }
              style={numberInputStyle}
            />
          }
        />

        <SectionTitle>存储与其他</SectionTitle>
        <SettingRow
          label="规则作用域"
          description="当前项目仍按 origin 独立保存规则与设置，不提供跨域共享开关。"
          control={<InfoTag>按域名保存</InfoTag>}
        />
        <SettingRow
          label="当前页面"
          description="此面板的规则和日志均绑定到当前 DevTools 检查目标。"
          control={<InfoTag>实时生效</InfoTag>}
          last
        />
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: "10px 12px 4px",
        background: panelTheme.bg,
        borderTop: `1px solid ${panelTheme.border}`,
        borderBottom: `1px solid ${panelTheme.border}`,
        fontSize: 10,
        fontWeight: 600,
        color: panelTheme.textSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
      }}
    >
      {children}
    </div>
  );
}

function SettingRow({
  label,
  description,
  control,
  last = false,
}: {
  label: string;
  description: string;
  control: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderBottom: last ? "none" : `1px solid ${panelTheme.border}`,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          background: panelTheme.blueBg,
          color: panelTheme.blue,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        设
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: panelTheme.text, fontWeight: 500 }}>
          {label}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            lineHeight: 1.5,
            color: panelTheme.textSecondary,
          }}
        >
          {description}
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          paddingTop: 3,
        }}
      >
        {control}
      </div>
    </div>
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
      onClick={() => onChange(!checked)}
      style={{
        width: 28,
        height: 16,
        padding: 0,
        border: "none",
        borderRadius: 99,
        background: checked ? panelTheme.switchOn : panelTheme.switchOff,
        position: "relative",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 14 : 2,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        }}
      />
    </button>
  );
}

function InfoTag({ children }: { children: string }) {
  return <span style={infoTagStyle}>{children}</span>;
}

const numberInputStyle: CSSProperties = {
  width: 80,
  height: 24,
  padding: "0 6px",
  textAlign: "right",
  fontSize: 12,
  fontFamily: panelTheme.mono,
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: panelTheme.panel,
  color: panelTheme.text,
  outline: "none",
};

const infoTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 20,
  padding: "0 8px",
  borderRadius: 10,
  background: panelTheme.blueBg,
  color: panelTheme.blue,
  fontSize: 11,
  fontWeight: 600,
};
