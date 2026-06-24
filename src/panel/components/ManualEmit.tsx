import { useState, type CSSProperties, type ReactNode } from "react";
import { panelTheme } from "../designSystem";
import type { ManualEmitProps } from "../types";

interface RecentEmitItem {
  id: string;
  time: string;
  eventName: string;
  detailText: string;
}

export function ManualEmit({
  draft,
  onChange,
  onSend,
  onFormat,
}: ManualEmitProps) {
  const [recentItems, setRecentItems] = useState<RecentEmitItem[]>([]);

  function handleSend() {
    if (!draft.eventName.trim()) {
      onSend();
      return;
    }

    setRecentItems((current) => [
      {
        id: `${Date.now()}-${current.length}`,
        time: formatTime(new Date()),
        eventName: draft.eventName.trim(),
        detailText: draft.detailText,
      },
      ...current,
    ].slice(0, 8));
    onSend();
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
      <div
        style={{
          padding: "6px 8px",
          borderBottom: `1px solid ${panelTheme.border}`,
          background: panelTheme.toolbar,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 500, color: panelTheme.text }}>
          手动发送
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            lineHeight: 1.5,
            color: panelTheme.textSecondary,
          }}
        >
          模拟 Native 到 H5 的事件回调，当前实现会通过
          <code style={inlineCodeStyle}>window.dispatchEvent</code>
          派发到页面。
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        <FormRow label="事件名称" mono>
          <input
            value={draft.eventName}
            onChange={(event) =>
              onChange({ ...draft, eventName: event.target.value })
            }
            placeholder="例如 getUserInfoCallback"
            style={monoFieldStyle}
          />
        </FormRow>

        <div style={{ marginTop: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <span style={sectionLabelStyle}>事件 detail (JSON)</span>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onFormat} style={outlineButtonStyle}>
              格式化
            </button>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(draft.detailText)}
              style={ghostButtonStyle}
            >
              复制
            </button>
          </div>
          <textarea
            value={draft.detailText}
            onChange={(event) =>
              onChange({ ...draft, detailText: event.target.value })
            }
            spellCheck={false}
            style={textAreaStyle}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={handleSend}
            style={{
              ...primaryButtonStyle,
              opacity: draft.eventName.trim() ? 1 : 0.7,
            }}
          >
            发送到页面
          </button>
        </div>

        {recentItems.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <div style={dividerStyle} />
            <div
              style={{
                padding: "8px 0 4px",
                fontSize: 11,
                fontWeight: 600,
                color: panelTheme.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              最近发送记录
            </div>
            {recentItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onChange({
                    eventName: item.eventName,
                    detailText: item.detailText,
                  })
                }
                style={recentRowStyle}
              >
                <span style={recentTimeStyle}>{item.time}</span>
                <span style={recentEventStyle}>{item.eventName}</span>
                <span style={recentDetailStyle}>
                  {summarize(item.detailText)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FormRow({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <label
        style={{
          width: 100,
          flexShrink: 0,
          fontSize: 12,
          color: panelTheme.textSecondary,
          fontFamily: mono ? panelTheme.mono : panelTheme.sans,
        }}
      >
        {label}
      </label>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function formatTime(value: Date): string {
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  const millisecond = String(value.getMilliseconds()).padStart(3, "0");
  return `${hour}:${minute}:${second}.${millisecond}`;
}

function summarize(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

const fieldStyle: CSSProperties = {
  width: "100%",
  height: 24,
  padding: "0 6px",
  fontSize: 12,
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: panelTheme.panel,
  color: panelTheme.text,
  outline: "none",
  boxSizing: "border-box",
};

const monoFieldStyle: CSSProperties = {
  ...fieldStyle,
  fontFamily: panelTheme.mono,
};

const textAreaStyle: CSSProperties = {
  width: "100%",
  height: 140,
  padding: "6px 8px",
  fontSize: 11,
  lineHeight: 1.6,
  fontFamily: panelTheme.mono,
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: "#fafafe",
  color: panelTheme.text,
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: panelTheme.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const inlineCodeStyle: CSSProperties = {
  margin: "0 4px",
  padding: "0 3px",
  borderRadius: 2,
  background: panelTheme.bg,
  fontFamily: panelTheme.mono,
  fontSize: 10,
};

const ghostButtonStyle: CSSProperties = {
  height: 22,
  padding: "0 6px",
  border: "none",
  background: "transparent",
  color: panelTheme.textSecondary,
  fontSize: 11,
  cursor: "pointer",
};

const outlineButtonStyle: CSSProperties = {
  height: 22,
  padding: "0 6px",
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: panelTheme.panel,
  color: panelTheme.text,
  fontSize: 11,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  height: 28,
  padding: "0 10px",
  border: "none",
  borderRadius: 2,
  background: panelTheme.blue,
  color: "#fff",
  fontSize: 12,
  cursor: "pointer",
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: panelTheme.border,
};

const recentRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  padding: "4px 6px",
  border: "none",
  borderRadius: 2,
  background: "transparent",
  textAlign: "left",
  cursor: "pointer",
};

const recentTimeStyle: CSSProperties = {
  width: 84,
  flexShrink: 0,
  fontSize: 10,
  fontFamily: panelTheme.mono,
  color: panelTheme.textDisabled,
};

const recentEventStyle: CSSProperties = {
  flexShrink: 0,
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 11,
  fontFamily: panelTheme.mono,
  color: panelTheme.blue,
};

const recentDetailStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 10,
  fontFamily: panelTheme.mono,
  color: panelTheme.textSecondary,
};
