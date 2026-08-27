import type { CSSProperties, ReactNode } from "react";
import type { BridgeProfile, BridgeProfileId } from "../../shared/bridgeProfiles";
import type { OriginBridgeSettings } from "../../shared/ruleTypes";
import { panelTheme } from "../designSystem";

interface SettingsPanelProps {
  activeProfileId: BridgeProfileId | null;
  profiles: BridgeProfile[];
  settings: OriginBridgeSettings | null;
  onChange: (settings: Partial<OriginBridgeSettings>) => void;
  onSelectProfile: (profileId: BridgeProfileId) => void;
}

export function SettingsPanel({
  activeProfileId,
  profiles,
  settings,
  onChange,
  onSelectProfile,
}: SettingsPanelProps) {
  if (!settings || !activeProfileId) {
    return (
      <section style={loadingStyle}>
        等待当前页面设置加载
      </section>
    );
  }

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  if (!activeProfile) {
    return <section style={loadingStyle}>等待当前桥接方案加载</section>;
  }

  return (
    <section style={panelStyle}>
      <div style={bodyStyle}>
        <SectionTitle>桥接方案</SectionTitle>
        <div style={profileSectionStyle}>
          <div style={profileListStyle}>
            {profiles.map((profile) => {
              const active = profile.id === activeProfileId;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onSelectProfile(profile.id)}
                  style={getProfileCardStyle(active)}
                >
                  <div style={profileCardTopStyle}>
                    <span style={getProfileBadgeStyle(active)}>{profile.id}</span>
                    <span style={profileTitleStyle}>{profile.title}</span>
                    <span style={getProfileStateStyle(active)}>
                      {active ? "当前方案" : "点击切换"}
                    </span>
                  </div>
                  <div style={profileHostStyle}>window.{profile.hostObject}.postMessage</div>
                </button>
              );
            })}
          </div>
        </div>

        <SectionTitle>拦截设置</SectionTitle>
        <SettingRow
          label="当前宿主对象"
          description="当前方案会把 H5 桥接消息发送到这个入口；切换方案会同步切换宿主对象。"
          control={<InfoTag>{`window.${activeProfile.hostObject}.postMessage`}</InfoTag>}
        />
        <SettingRow
          label="当前字段路径"
          description="自动匹配读取桥接消息顶层的此字段；响应 detail 的结构仍以规则包中的配置为准。"
          control={<InfoTag>{activeProfile.requestEventField ?? "event"}</InfoTag>}
        />
        <SettingRow
          label="自动模拟"
          description="启用后，匹配的桥接请求会自动返回当前方案下规则中的响应。"
          control={
            <ToggleSwitch
              checked={settings.autoMock}
              onChange={(checked) => onChange({ autoMock: checked })}
            />
          }
        />
        <SettingRow
          label={`覆盖 ${activeProfile.hostObject}`}
          description="若页面已注入当前方案同名对象，则强制覆盖；原生环境已存在时应谨慎开启。"
          control={
            <ToggleSwitch
              checked={settings.overrideExistingBridge}
              onChange={(checked) => onChange({ overrideExistingBridge: checked })}
            />
          }
        />

        <SectionTitle>日志设置</SectionTitle>
        <SettingRow
          label="保留日志"
          description="刷新快照或规则变化时继续保留当前方案下已记录的桥接日志。"
          control={
            <ToggleSwitch
              checked={settings.preserveLogs}
              onChange={(checked) => onChange({ preserveLogs: checked })}
            />
          }
        />
        <SettingRow
          label="日志上限"
          description="超过上限后，将自动丢弃当前方案下最早的日志。"
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
          description="当前项目按 origin + 方案独立保存规则与设置，不提供跨域共享开关。"
          control={<InfoTag>按域名隔离</InfoTag>}
        />
        <SettingRow
          label="当前页面"
          description="此面板的规则和日志均绑定到当前 DevTools 检查目标，并随当前方案实时生效。"
          control={<InfoTag>实时生效</InfoTag>}
          last
        />
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={sectionTitleStyle}>
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
    <div style={getSettingRowStyle(last)}>
      <div style={rowIconStyle}>设</div>
      <div style={rowContentStyle}>
        <div style={rowLabelStyle}>{label}</div>
        <div style={rowDescriptionStyle}>{description}</div>
      </div>
      <div style={rowControlStyle}>{control}</div>
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
    <button type="button" onClick={() => onChange(!checked)} style={getToggleStyle(checked)}>
      <span style={getToggleThumbStyle(checked)} />
    </button>
  );
}

function InfoTag({ children }: { children: string }) {
  return <span style={infoTagStyle}>{children}</span>;
}

function getProfileCardStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 8,
    border: `1px solid ${active ? panelTheme.blue : panelTheme.border}`,
    background: active ? panelTheme.blueBg : panelTheme.panel,
    textAlign: "left",
    cursor: "pointer",
  };
}

function getProfileBadgeStyle(active: boolean): CSSProperties {
  return {
    minWidth: 28,
    height: 18,
    padding: "0 8px",
    borderRadius: 999,
    background: active ? panelTheme.blue : panelTheme.panel,
    color: active ? "#fff" : panelTheme.blue,
    fontSize: 10,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function getProfileStateStyle(active: boolean): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 600,
    color: active ? panelTheme.blue : panelTheme.textDisabled,
  };
}

function getSettingRowStyle(last: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderBottom: last ? "none" : `1px solid ${panelTheme.border}`,
  };
}

function getToggleStyle(checked: boolean): CSSProperties {
  return {
    width: 28,
    height: 16,
    padding: 0,
    border: "none",
    borderRadius: 99,
    background: checked ? panelTheme.switchOn : panelTheme.switchOff,
    position: "relative",
    cursor: "pointer",
  };
}

function getToggleThumbStyle(checked: boolean): CSSProperties {
  return {
    position: "absolute",
    top: 2,
    left: checked ? 14 : 2,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
  };
}

const loadingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  background: panelTheme.panel,
  color: panelTheme.textDisabled,
};

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: panelTheme.panel,
};

const bodyStyle: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto" };
const sectionTitleStyle: CSSProperties = {
  padding: "10px 12px 4px",
  background: panelTheme.bg,
  borderTop: `1px solid ${panelTheme.border}`,
  borderBottom: `1px solid ${panelTheme.border}`,
  fontSize: 10,
  fontWeight: 600,
  color: panelTheme.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.6px",
};

const profileSectionStyle: CSSProperties = {
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const profileListStyle: CSSProperties = { display: "grid", gap: 10 };
const profileCardTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const profileTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: panelTheme.text,
};
const profileHostStyle: CSSProperties = {
  color: panelTheme.textSecondary,
  fontFamily: panelTheme.mono,
  fontSize: 12,
};
const rowIconStyle: CSSProperties = {
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
};
const rowContentStyle: CSSProperties = { flex: 1, minWidth: 0 };
const rowLabelStyle: CSSProperties = {
  fontSize: 13,
  color: panelTheme.text,
  fontWeight: 500,
};
const rowDescriptionStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  lineHeight: 1.5,
  color: panelTheme.textSecondary,
};
const rowControlStyle: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  paddingTop: 3,
};
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
