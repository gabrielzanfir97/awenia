"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  AweniaShell,
  AweniaHeader,
  Card,
  Button,
  StatusBadge,
  CodeBlock,
  FileDropInfo,
  createUIMessage,
  ChatMessage,
} from "./ui";

type UploadedFile = {
  name: string;
  type: string;
  size: number;
  content: string;
  encoding: "text" | "data_url";
};

type ApiResponse = {
  reply?: string;
  result?: any;
  error?: string;
  status?: string;
  verified?: boolean;
  tool?: string;
};

const QUICK_COMMANDS = [
  "CHECK_AWENIA_STATUS",
  "CHECK_PROJECT_STATE",
  "CHECK_MEMORY_SYSTEM",
  "CHECK_SUPABASE_SYSTEM",
  "CHECK_INTERNET_SYSTEM",
  "RUN_AUTONOMOUS_TESTS",
];

function now() {
  return new Date().toISOString();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function isTextFile(file: File) {
  return (
    file.type.startsWith("text/") ||
    file.name.endsWith(".ts") ||
    file.name.endsWith(".tsx") ||
    file.name.endsWith(".js") ||
    file.name.endsWith(".jsx") ||
    file.name.endsWith(".json") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".css") ||
    file.name.endsWith(".html")
  );
}

function readFile(file: File): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error(`Nu pot citi fișierul: ${file.name}`));
    };

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || "unknown",
        size: file.size,
        content: String(reader.result || ""),
        encoding: isTextFile(file) ? "text" : "data_url",
      });
    };

    if (isTextFile(file)) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

function splitCodeBlocks(content: string) {
  const parts: Array<{
    type: "text" | "code";
    content: string;
    language?: string;
  }> = [];

  const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: "code",
      language: match[1] || "txt",
      content: match[2] || "",
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return parts.length
    ? parts
    : [
      {
        type: "text" as const,
        content,
      },
    ];
}

function MessageView({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";
  const parts = splitCodeBlocks(message.content);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          width: "fit-content",
          maxWidth: "88%",
          borderRadius: 18,
          padding: 14,
          background: isUser ? "#111827" : "#ffffff",
          color: isUser ? "#ffffff" : "#111827",
          border: isUser ? "none" : "1px solid #e5e7eb",
          boxShadow: isUser ? "none" : "0 8px 26px rgba(0,0,0,0.04)",
        }}
      >
        {parts.map((part, index) => {
          if (part.type === "code") {
            return (
              <div key={index} style={{ margin: "10px 0" }}>
                <CodeBlock
                  code={part.content}
                  language={part.language || "txt"}
                />
              </div>
            );
          }

          return (
            <div
              key={index}
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                fontSize: 15,
              }}
            >
              {part.content}
            </div>
          );
        })}

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginTop: 8,
            fontSize: 11,
            opacity: 0.75,
          }}
        >
          <span>
            {message.timestamp
              ? new Date(message.timestamp).toLocaleTimeString("ro-RO", {
                hour: "2-digit",
                minute: "2-digit",
              })
              : ""}
          </span>

          {message.status && (
            <StatusBadge status={message.status} label={message.status} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    createUIMessage(
      "assistant",
      "Bună, Gabi. Sunt Awenia. Continuăm pas cu pas."
    ),
  ]);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = useMemo(() => {
    return input.trim().length > 0 && !loading;
  }, [input, loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function handleFiles(selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setError("");

    try {
      const parsed = await Promise.all(
        Array.from(selectedFiles).map((file) => readFile(file))
      );

      setFiles((current) => [...current, ...parsed]);
    } catch (err: any) {
      setError(err?.message || "Nu am putut citi fișierele.");
    }
  }

  function removeFile(name: string) {
    setFiles((current) => current.filter((file) => file.name !== name));
  }

  function clearChat() {
    setMessages([
      createUIMessage(
        "assistant",
        "Chat curățat, Gabi. Continuăm de aici."
      ),
    ]);
    setInput("");
    setFiles([]);
    setError("");
    setStatus("ready");
  }

  async function sendMessage(customMessage?: string) {
    const messageText = (customMessage || input).trim();

    if (!messageText || loading) return;

    const userMessage = createUIMessage("user", messageText, {
      files: files.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        encoding: file.encoding,
      })),
    });

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    setStatus("thinking");
    setError("");

    const filesToSend = files;
    setFiles([]);

    try {
      const response = await fetch("/api/awenia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          files: filesToSend,
          timestamp: now(),
          source: "awenia-ui",
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `API error ${response.status}`);
      }

      const reply =
        data.reply ||
        (data.result ? JSON.stringify(data.result, null, 2) : "") ||
        "Gabi, Awenia nu a primit un răspuns clar.";

      setMessages((current) => [
        ...current,
        createUIMessage("assistant", reply, {
          status: data.status,
          verified: data.verified,
          tool: data.tool,
        }),
      ]);

      setStatus(data.verified ? "verified" : "ready");
    } catch (err: any) {
      const message =
        err?.message || "Awenia nu a putut răspunde acum.";

      setError(message);
      setStatus("error");

      setMessages((current) => [
        ...current,
        createUIMessage(
          "assistant",
          `Gabi, a apărut o eroare:\n${message}`,
          {
            error: true,
          }
        ),
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AweniaShell>
      <AweniaHeader
        title="Awenia"
        subtitle="AI personal local pentru Gabi"
        status={status}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 14,
        }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {QUICK_COMMANDS.map((command) => (
              <Button
                key={command}
                variant="secondary"
                disabled={loading}
                onClick={() => sendMessage(command)}
              >
                {command}
              </Button>
            ))}

            <Button
              variant="ghost"
              disabled={loading}
              onClick={clearChat}
            >
              Curăță chat
            </Button>
          </div>

          <div
            style={{
              minHeight: 420,
              maxHeight: "62vh",
              overflowY: "auto",
              padding: 4,
            }}
          >
            {messages.map((message, index) => (
              <MessageView
                key={message.id || index}
                message={message}
              />
            ))}

            {loading && (
              <div style={{ margin: "12px 0", color: "#6b7280" }}>
                Awenia gândește...
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </Card>

        <Card>
          <div style={{ marginBottom: 10 }}>
            <FileDropInfo filesCount={files.length} />
          </div>

          {files.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {files.map((file) => (
                <div
                  key={file.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: 10,
                    borderRadius: 12,
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <span>
                    {file.name} — {formatBytes(file.size)}
                  </span>

                  <button
                    onClick={() => removeFile(file.name)}
                    style={{
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(event) => handleFiles(event.target.files)}
            style={{ display: "none" }}
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-end",
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Scrie pentru Awenia..."
              disabled={loading}
              rows={3}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              style={{
                flex: 1,
                resize: "none",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                padding: 12,
                outline: "none",
                fontSize: 15,
                lineHeight: 1.5,
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
              >
                Fișier
              </Button>

              <Button
                disabled={!canSend}
                onClick={() => sendMessage()}
              >
                Trimite
              </Button>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 10,
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              marginTop: 12,
              color: "#6b7280",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Statusul din UI nu confirmă build-ul. Build-ul se verifică separat
            în terminal.
          </div>
        </Card>
      </div>
    </AweniaShell>
  );
}