import type { ReactNode } from "react";

type BadgeTone = "blue" | "green" | "orange" | "red" | "gray";

export function PaneHeader({
  title,
  subtitle,
  extra,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`workspace-pane__header${compact ? " is-compact" : ""}`}>
      <div>
        <h3 className="workspace-pane__title">{title}</h3>
        {subtitle ? <p className="workspace-pane__subtitle">{subtitle}</p> : null}
      </div>
      <div className="spacer" />
      {extra}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__title">{title}</div>
      <div className="empty-state__description">{description}</div>
      {action}
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`toggle${checked ? " is-checked" : ""}`}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__thumb" />
    </button>
  );
}

export function StatusDot({ active }: { active: boolean }) {
  return <span className={`status-dot${active ? " is-active" : ""}`} />;
}

export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: ReactNode;
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Field({
  label,
  children,
  hint,
  span2 = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  span2?: boolean;
}) {
  return (
    <label className={`form-field${span2 ? " is-span-2" : ""}`}>
      <span className="form-label">{label}</span>
      {children}
      {hint ? <span className="workspace-pane__subtitle">{hint}</span> : null}
    </label>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="control-field"
    />
  );
}

export function FooterActions({
  primary,
  secondary,
  danger,
}: {
  primary?: ReactNode;
  secondary?: ReactNode;
  danger?: ReactNode;
}) {
  return (
    <div className="workspace-pane__footer">
      {primary}
      {secondary}
      <div className="spacer" />
      {danger}
    </div>
  );
}
