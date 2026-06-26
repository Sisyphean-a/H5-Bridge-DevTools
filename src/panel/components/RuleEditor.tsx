import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { panelTheme } from "../designSystem";
import type { RuleEditorProps } from "../types";

export function RuleEditor({
  draft,
  isNarrow,
  onChange,
  onSave,
  onDelete,
  onDuplicate,
  onReset,
  onFormatJson,
  onTestEmit,
  presets,
  onLoadPreset,
  onBack,
}: RuleEditorProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!draft) {
      return;
    }
    containerRef.current?.focus();
  }, [draft]);

  if (!draft) {
    return <EmptyEditor />;
  }

  return (
    <section
      ref={containerRef}
      tabIndex={-1}
      onKeyDownCapture={(event) => handleEditorKeyDown(event, onSave)}
      onMouseDownCapture={(event) => handleEditorMouseBack(event, isNarrow, onBack)}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: panelTheme.panel,
        outline: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 8px",
          background: panelTheme.toolbar,
          borderBottom: `1px solid ${panelTheme.border}`,
          flexShrink: 0,
        }}
      >
        {isNarrow && onBack ? (
          <button type="button" onClick={onBack} style={ghostButtonStyle}>
            返回
          </button>
        ) : null}
        <span style={{ fontSize: 12, color: panelTheme.textSecondary, fontWeight: 500 }}>
          {draft.name || "编辑规则"}
        </span>
        <div style={{ flex: 1 }} />
        <ToggleSwitch
          checked={draft.enabled}
          onChange={(enabled) => onChange({ ...draft, enabled })}
        />
        <span
          style={{
            fontSize: 11,
            color: draft.enabled ? panelTheme.green : panelTheme.textDisabled,
          }}
        >
          {draft.enabled ? "已启用" : "已禁用"}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        <FormRow label="规则名称">
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            style={fieldStyle}
          />
        </FormRow>
        <FormRow label="匹配事件" mono>
          <input
            value={draft.matchEvent}
            onChange={(event) => onChange({ ...draft, matchEvent: event.target.value })}
            style={monoFieldStyle}
          />
        </FormRow>
        <FormRow label="延迟 (ms)">
          <input
            type="number"
            min={0}
            value={draft.delayMs}
            onChange={(event) => onChange({ ...draft, delayMs: event.target.value })}
            style={{ ...monoFieldStyle, width: 90 }}
          />
        </FormRow>
        <FormRow label="响应模式">
          <select value={draft.mode} style={fieldStyle}>
            <option value="dispatchEvent">dispatchEvent（派发事件）</option>
          </select>
        </FormRow>
        <FormRow label="事件名称" mono>
          <input
            value={draft.eventName}
            onChange={(event) => onChange({ ...draft, eventName: event.target.value })}
            style={monoFieldStyle}
          />
        </FormRow>
        <FormRow label="模板">
          <select
            value=""
            onChange={(event) => {
              const preset = presets.find((item) => item.id === event.target.value) ?? null;
              onLoadPreset(preset);
              event.target.value = "";
            }}
            style={fieldStyle}
          >
            <option value="">从模板填充</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </FormRow>

        <div style={{ marginTop: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 4,
            }}
          >
            <span style={sectionLabelStyle}>响应内容 (JSON)</span>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onFormatJson} style={ghostButtonStyle}>
              格式化
            </button>
          </div>
          <textarea
            value={draft.detailText}
            onChange={(event) => onChange({ ...draft, detailText: event.target.value })}
            spellCheck={false}
            style={textAreaStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderTop: `1px solid ${panelTheme.border}`,
          background: panelTheme.toolbar,
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={onSave} style={primaryButtonStyle}>
          保存
        </button>
        <button type="button" onClick={onTestEmit} style={outlineButtonStyle}>
          测试发送
        </button>
        <button type="button" onClick={onDuplicate} style={outlineButtonStyle}>
          复制
        </button>
        <button type="button" onClick={onReset} style={outlineButtonStyle}>
          重置
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onDelete} style={dangerButtonStyle}>
          删除
        </button>
      </div>
    </section>
  );
}

function handleEditorKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  onSave: RuleEditorProps["onSave"],
): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    event.stopPropagation();
    onSave();
    return;
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function handleEditorMouseBack(
  event: ReactMouseEvent<HTMLElement>,
  isNarrow: boolean,
  onBack: RuleEditorProps["onBack"],
): void {
  if (!isNarrow || !onBack || event.button !== 3) {
    return;
  }
  if (isEditableTarget(event.target)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  onBack();
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
        padding: "3px 0",
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

function EmptyEditor() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: panelTheme.textDisabled,
      }}
    >
      选择规则进行编辑
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
        width: 24,
        height: 14,
        borderRadius: 99,
        border: "none",
        background: checked ? panelTheme.switchOn : panelTheme.switchOff,
        position: "relative",
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
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        }}
      />
    </button>
  );
}

const fieldStyle = {
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
} as const;

const monoFieldStyle = {
  ...fieldStyle,
  fontFamily: panelTheme.mono,
} as const;

const textAreaStyle = {
  width: "100%",
  height: 170,
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
} as const;

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: panelTheme.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
} as const;

const ghostButtonStyle = {
  height: 22,
  padding: "0 6px",
  border: "none",
  background: "transparent",
  color: panelTheme.textSecondary,
  fontSize: 11,
  cursor: "pointer",
} as const;

const outlineButtonStyle = {
  height: 26,
  padding: "0 8px",
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: panelTheme.panel,
  color: panelTheme.text,
  fontSize: 12,
  cursor: "pointer",
} as const;

const primaryButtonStyle = {
  ...outlineButtonStyle,
  border: "none",
  background: panelTheme.blue,
  color: "#fff",
} as const;

const dangerButtonStyle = {
  ...outlineButtonStyle,
  border: "none",
  background: panelTheme.red,
  color: "#fff",
} as const;
