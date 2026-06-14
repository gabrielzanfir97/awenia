"use client";

import { ReactNode, useMemo, useState } from "react";

export type UIStatus =
  | "idle"
  | "loading"
  | "success"
  | "warning"
  | "error"
  | "blocked"
  | "verified"
  | "not_checked";

export type ChatRole =
  | "user"
  | "assistant"
  | "system"
  | "tool";

export type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: string;
  timestamp?: string;
  status?: UIStatus;
  metadata?: any;
};

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";

export type UITheme = {
  surface: string;
  surfaceSoft: string;
  text: string;
  muted: string;
  border: string;
  radius: number;
};

export const defaultTheme: UITheme = {
  surface: "#ffffff",
  surfaceSoft: "#f6f7fb",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  radius: 18,
};

function now() {
  return new Date().toISOString();
}

export function cn(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

export function formatTime(value?: string) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function StatusBadge({
  status,
  label,
}: {
  status: UIStatus;
  label?: string;
}) {
  const text = label || status;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        border: "1px solid rgba(0,0,0,0.08)",
        background:
          status === "success" || status === "verified"
            ? "#ecfdf5"
            : status === "warning" || status === "not_checked"
              ? "#fffbeb"
              : status === "error" || status === "blocked"
                ? "#fef2f2"
                : status === "loading"
                  ? "#eff6ff"
                  : "#f9fafb",
      }}
    >
      {text}
    </span>
  );
}

export function Card({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        background: defaultTheme.surface,
        border: `1px solid ${defaultTheme.border}`,
        borderRadius: defaultTheme.radius,
        padding: 16,
        boxShadow: "0 8px 28px rgba(0,0,0,0.04)",
      }}
    >
      {title && (
        <div style={{ marginBottom: subtitle ? 4 : 12 }}>
          <strong>{title}</strong>
        </div>
      )}

      {subtitle && (
        <div
          style={{
            color: defaultTheme.muted,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {subtitle}
        </div>
      )}

      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  type?: "button" | "submit";
}) {
  const background =
    variant === "primary"
      ? "#111827"
      : variant === "danger"
        ? "#991b1b"
        : variant === "secondary"
          ? "#f3f4f6"
          : "transparent";

  const color =
    variant === "primary" || variant === "danger"
      ? "#ffffff"
      : "#111827";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${defaultTheme.border}`,
        borderRadius: 12,
        padding: "10px 14px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        background,
        color,
      }}
    >
      {children}
    </button>
  );
}

export function LoadingDots({
  label = "Awenia gândește",
}: {
  label?: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        color: defaultTheme.muted,
        fontSize: 14,
      }}
    >
      <span>{label}</span>
      <span>...</span>
    </div>
  );
}

export function EmptyState({
  title = "Awenia este pregătită",
  description = "Scrie mesajul tău și continuăm pas cu pas.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <div style={{ textAlign: "center", padding: 24 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={{ color: defaultTheme.muted }}>{description}</p>
      </div>
    </Card>
  );
}

export function CodeBlock({
  code,
  language = "ts",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: `1px solid ${defaultTheme.border}`,
        background: "#0b1020",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 12px",
          color: "#d1d5db",
          fontSize: 12,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span>{language}</span>
        <button
          onClick={copy}
          style={{
            background: "transparent",
            color: "#d1d5db",
            border: 0,
            cursor: "pointer",
          }}
        >
          {copied ? "Copiat" : "Copiază"}
        </button>
      </div>

      <pre
        style={{
          margin: 0,
          padding: 14,
          overflowX: "auto",
          color: "#f9fafb",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          borderRadius: 18,
          padding: "12px 14px",
          background: isUser ? "#111827" : defaultTheme.surfaceSoft,
          color: isUser ? "#ffffff" : defaultTheme.text,
          border: isUser ? "none" : `1px solid ${defaultTheme.border}`,
          whiteSpace: "pre-wrap",
          lineHeight: 1.55,
        }}
      >
        <div>{message.content}</div>

        {(message.timestamp || message.status) && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              alignItems: "center",
              color: isUser ? "#d1d5db" : defaultTheme.muted,
              fontSize: 11,
            }}
          >
            {message.timestamp && <span>{formatTime(message.timestamp)}</span>}
            {message.status && (
              <StatusBadge status={message.status} label={message.status} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  loading = false,
}: {
  messages: ChatMessage[];
  loading?: boolean;
}) {
  if (!messages.length && !loading) {
    return <EmptyState />;
  }

  return (
    <div>
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id || `${message.role}-${index}`}
          message={message}
        />
      ))}

      {loading && <LoadingDots />}
    </div>
  );
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Scrie pentru Awenia...",
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  function submit() {
    if (!value.trim() || disabled) return;
    onSend();
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-end",
      }}
    >
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        style={{
          flex: 1,
          resize: "none",
          borderRadius: 14,
          border: `1px solid ${defaultTheme.border}`,
          padding: 12,
          outline: "none",
          fontSize: 15,
          lineHeight: 1.5,
        }}
      />

      <Button onClick={submit} disabled={disabled || !value.trim()}>
        Trimite
      </Button>
    </div>
  );
}

export function FileDropInfo({
  filesCount = 0,
}: {
  filesCount?: number;
}) {
  return (
    <div
      style={{
        border: `1px dashed ${defaultTheme.border}`,
        borderRadius: 14,
        padding: 12,
        color: defaultTheme.muted,
        fontSize: 13,
        background: defaultTheme.surfaceSoft,
      }}
    >
      {filesCount > 0
        ? `${filesCount} fișier(e) pregătite`
        : "Poți atașa fișiere pentru analiză."}
    </div>
  );
}

export function ToolResultView({
  title = "Tool result",
  result,
}: {
  title?: string;
  result: any;
}) {
  const text = useMemo(() => {
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }, [result]);

  return (
    <Card title={title}>
      <CodeBlock code={text} language="json" />
    </Card>
  );
}

export function AweniaHeader({
  title = "Awenia",
  subtitle = "AI personal local pentru Gabi",
  status = "ready",
}: {
  title?: string;
  subtitle?: string;
  status?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        marginBottom: 16,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
        <div style={{ color: defaultTheme.muted, fontSize: 13 }}>
          {subtitle}
        </div>
      </div>

      <StatusBadge status="verified" label={status} />
    </div>
  );
}

export function AweniaShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f9fafb 0%, #eef2ff 100%)",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </main>
  );
}

export function createUIMessage(
  role: ChatRole,
  content: string,
  metadata?: any
): ChatMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    role,
    content,
    timestamp: now(),
    metadata,
  };
}

export function getUIState() {
  return {
    status: "ready",
    components: [
      "AweniaShell",
      "AweniaHeader",
      "ChatMessages",
      "MessageBubble",
      "ChatInput",
      "CodeBlock",
      "Card",
      "Button",
      "StatusBadge",
      "ToolResultView",
      "FileDropInfo",
    ],
    truthPolicy: {
      uiDoesNotConfirmBackendStatus: true,
      uiDoesNotConfirmBuildStatus: true,
      statusBadgesAreDisplayOnly: true,
    },
    timestamp: now(),
  };
}

export const Header = AweniaHeader;
export const Shell = AweniaShell;
export const Message = MessageBubble;
export const Messages = ChatMessages;
export const Input = ChatInput;
export const Badge = StatusBadge;
export const Panel = Card;
export const CopyableCode = CodeBlock;

const UI = {
  AweniaShell,
  AweniaHeader,
  ChatMessages,
  MessageBubble,
  ChatInput,
  CodeBlock,
  Card,
  Button,
  StatusBadge,
  ToolResultView,
  FileDropInfo,
  EmptyState,
  LoadingDots,
  createUIMessage,
  getUIState,
};

export default UI;