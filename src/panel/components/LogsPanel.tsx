import { useMemo, useState, type CSSProperties } from "react";
import type { BridgeLogItem, BridgeLogType } from "../../shared/bridgeTypes";
import { formatJson } from "../../shared/json";
import { logTypeColors, panelTheme } from "../designSystem";
import type { LogsPanelProps } from "../types";

const logFilterTypes: Array<BridgeLogType | "ALL"> = [
  "ALL",
  "SEND",
  "MOCK",
  "EMIT",
  "WARN",
  "ERROR",
];

export function LogsPanel({
  logs,
  activeEvent,
  compact,
  onCopyPayload,
  onCreateRule,
  onReplay,
  onFilterEvent,
  onClear,
  renderPayload,
  renderResponse,
}: LogsPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [typeFilter, setTypeFilter] = useState<BridgeLogType | "ALL">("ALL");
  const [searchText, setSearchText] = useState("");

  const visibleLogs = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return logs.filter((log) => {
      if (typeFilter !== "ALL" && log.type !== typeFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const eventText = (log.event ?? "").toLowerCase();
      const messageText = (log.message ?? "").toLowerCase();
      const detailText = formatJson(log.response ?? log.payload ?? {}).toLowerCase();
      return (
        eventText.includes(keyword) ||
        messageText.includes(keyword) ||
        detailText.includes(keyword)
      );
    });
  }, [logs, searchText, typeFilter]);

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: panelTheme.panel,
      }}
    >
      <div style={toolbarStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flex: 1,
            minWidth: 0,
            overflowX: "auto",
          }}
        >
          {logFilterTypes.map((type) => {
            const active = typeFilter === type;
            const colors =
              type === "ALL"
                ? { bg: panelTheme.blueBg, text: panelTheme.blue }
                : logTypeColors[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                style={{
                  ...filterButtonStyle,
                  background: active ? colors.bg : "transparent",
                  borderColor: active ? colors.text : panelTheme.border,
                  color: active ? colors.text : panelTheme.textSecondary,
                }}
              >
                {type}
              </button>
            );
          })}
          {activeEvent ? (
            <button
              type="button"
              onClick={() => onFilterEvent(null)}
              style={{ ...ghostButtonStyle, color: panelTheme.blue }}
            >
              清除事件筛选
            </button>
          ) : null}
        </div>
        <button type="button" onClick={onClear} style={dangerGhostButtonStyle}>
          清空
        </button>
      </div>

      {!compact ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderBottom: `1px solid ${panelTheme.border}`,
            flexShrink: 0,
          }}
        >
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="按事件名、消息或内容筛选..."
            style={searchInputStyle}
          />
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {visibleLogs.length === 0 ? (
          <EmptyState
            title={searchText || typeFilter !== "ALL" ? "无匹配日志" : "暂无日志"}
            subtitle={
              searchText || typeFilter !== "ALL"
                ? "请尝试更改筛选条件"
                : "拦截到桥接调用后，日志会显示在这里"
            }
          />
        ) : (
          visibleLogs.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              expanded={expandedIds.has(log.id)}
              onToggle={() =>
                setExpandedIds((current) => toggleExpanded(current, log.id))
              }
              onCopyPayload={onCopyPayload}
              onCreateRule={onCreateRule}
              onReplay={onReplay}
              onFilterEvent={onFilterEvent}
              renderPayload={renderPayload}
              renderResponse={renderResponse}
            />
          ))
        )}
      </div>

      <div style={footerStyle}>
        <span>{visibleLogs.length} 条日志</span>
        {typeFilter !== "ALL" || activeEvent ? (
          <span style={{ color: panelTheme.textDisabled }}>
            共 {logs.length} 条
          </span>
        ) : null}
        {activeEvent ? (
          <span
            style={{
              fontFamily: panelTheme.mono,
              color: panelTheme.blue,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeEvent}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function LogRow({
  log,
  expanded,
  onToggle,
  onCopyPayload,
  onCreateRule,
  onReplay,
  onFilterEvent,
  renderPayload,
  renderResponse,
}: {
  log: BridgeLogItem;
  expanded: boolean;
  onToggle: () => void;
  onCopyPayload: (text: string) => void;
  onCreateRule: (log: BridgeLogItem) => void;
  onReplay: (logId: string) => void;
  onFilterEvent: (eventName: string | null) => void;
  renderPayload: (log: BridgeLogItem) => string;
  renderResponse: (log: BridgeLogItem) => string;
}) {
  const [hovered, setHovered] = useState(false);
  const colors = logTypeColors[log.type];
  const hasDetail = Boolean(log.payload || log.response || log.message);

  return (
    <div style={{ borderBottom: `1px solid ${panelTheme.border}` }}>
      <div
        onClick={hasDetail ? onToggle : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minHeight: 30,
          padding: "0 8px",
          background: hovered ? panelTheme.rowHover : "transparent",
          cursor: hasDetail ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        <span
          style={{
            width: 12,
            flexShrink: 0,
            color: panelTheme.textDisabled,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          {hasDetail ? (expanded ? "▾" : "▸") : ""}
        </span>
        <span style={timeStyle}>
          {new Date(log.timestamp).toLocaleTimeString("zh-CN", {
            hour12: false,
          })}
        </span>
        <span
          style={{
            ...typeBadgeStyle,
            background: colors.bg,
            color: colors.text,
          }}
        >
          {log.type}
        </span>
        <span
          style={{
            maxWidth: compactTextWidth(log.event),
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 11,
            fontFamily: panelTheme.mono,
            color: colors.text,
            flexShrink: 0,
          }}
        >
          {log.event ?? "-"}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 11,
            color: panelTheme.textSecondary,
          }}
        >
          {buildSummary(log)}
        </span>
        {hovered ? (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
          >
            {log.payload ? (
              <button
                type="button"
                onClick={() => onCopyPayload(renderPayload(log))}
                style={rowActionButtonStyle}
              >
                复制请求
              </button>
            ) : null}
            {log.response ? (
              <button
                type="button"
                onClick={() => onCopyPayload(renderResponse(log))}
                style={rowActionButtonStyle}
              >
                复制响应
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onCreateRule(log)}
              style={rowActionButtonStyle}
            >
              创建规则
            </button>
            {log.response ? (
              <button
                type="button"
                onClick={() => onReplay(log.id)}
                style={rowActionButtonStyle}
              >
                重放
              </button>
            ) : null}
            {log.event ? (
              <button
                type="button"
                onClick={() => onFilterEvent(log.event ?? null)}
                style={rowActionButtonStyle}
              >
                仅看此事件
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {expanded && hasDetail ? (
        <div
          style={{
            margin: "0 8px 8px 26px",
            border: `1px solid ${panelTheme.border}`,
            borderRadius: 2,
            overflow: "hidden",
            background: "#fafafe",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minHeight: 26,
              padding: "0 6px",
              borderBottom: `1px solid ${panelTheme.border}`,
              background: panelTheme.toolbar,
            }}
          >
            <span style={detailLabelStyle}>详情</span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() =>
                onCopyPayload(
                  renderResponse(log) ||
                    renderPayload(log) ||
                    formatJson({ message: log.message ?? "" }),
                )
              }
              style={ghostButtonStyle}
            >
              复制 JSON
            </button>
          </div>
          {log.message ? (
            <div
              style={{
                padding: "6px 8px 0",
                fontSize: 11,
                color: panelTheme.textSecondary,
              }}
            >
              {log.message}
            </div>
          ) : null}
          {log.payload ? (
            <DetailBlock title="请求" value={renderPayload(log)} />
          ) : null}
          {log.response ? (
            <DetailBlock title="响应" value={renderResponse(log)} />
          ) : null}
          {!log.payload && !log.response && log.message ? (
            <DetailBlock
              title="内容"
              value={formatJson({ message: log.message })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ padding: "6px 8px 0" }}>
      <div style={detailLabelStyle}>{title}</div>
      <pre style={detailCodeStyle}>{value}</pre>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
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

function buildSummary(log: BridgeLogItem): string {
  if (log.message) {
    return log.message;
  }
  if (log.response) {
    return summarizeJson(log.response);
  }
  if (log.payload) {
    return summarizeJson(log.payload);
  }
  return "-";
}

function summarizeJson(value: unknown): string {
  const text = formatJson(value).replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function toggleExpanded(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  next.add(id);
  return next;
}

function compactTextWidth(eventName: string | undefined): number {
  if (!eventName) {
    return 60;
  }
  return 140;
}

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 36,
  padding: "0 8px",
  borderBottom: `1px solid ${panelTheme.border}`,
  background: panelTheme.toolbar,
  flexShrink: 0,
};

const filterButtonStyle: CSSProperties = {
  height: 22,
  padding: "0 7px",
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 10,
  background: "transparent",
  fontSize: 10,
  cursor: "pointer",
  flexShrink: 0,
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  height: 24,
  padding: "0 6px",
  fontSize: 11,
  fontFamily: panelTheme.mono,
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: panelTheme.bg,
  color: panelTheme.text,
  outline: "none",
};

const footerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 24,
  padding: "0 8px",
  borderTop: `1px solid ${panelTheme.border}`,
  background: panelTheme.toolbar,
  color: panelTheme.textSecondary,
  fontSize: 11,
  flexShrink: 0,
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

const dangerGhostButtonStyle: CSSProperties = {
  ...ghostButtonStyle,
  color: panelTheme.red,
};

const rowActionButtonStyle: CSSProperties = {
  height: 20,
  padding: "0 6px",
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  background: panelTheme.panel,
  color: panelTheme.textSecondary,
  fontSize: 10,
  cursor: "pointer",
};

const typeBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 40,
  height: 16,
  padding: "0 5px",
  borderRadius: 10,
  fontSize: 10,
  fontWeight: 600,
  flexShrink: 0,
};

const timeStyle: CSSProperties = {
  width: 64,
  fontSize: 10,
  fontFamily: panelTheme.mono,
  color: panelTheme.textDisabled,
  flexShrink: 0,
};

const detailLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: panelTheme.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const detailCodeStyle: CSSProperties = {
  margin: "4px 0 0",
  padding: "6px 8px",
  maxHeight: 160,
  overflow: "auto",
  background: panelTheme.panel,
  border: `1px solid ${panelTheme.border}`,
  borderRadius: 2,
  fontSize: 11,
  lineHeight: 1.6,
  fontFamily: panelTheme.mono,
  color: panelTheme.text,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};
