"use client";

import { useState } from "react";
import { AweniaCore } from "./awenia-core";
import { awakenAwenia } from "./orchestrator";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
  fileType?: string;
  fileData?: string;
};

function MessageContent({ content }: { content: string }) {
  const looksLikeCode =
    content.includes("import ") ||
    content.includes("export default") ||
    content.includes("function ") ||
    content.includes("const ") ||
    content.includes("type ") ||
    content.includes("className=") ||
    content.includes("return (");

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  if (content.includes("```")) {
    const parts = content.split(/```/g);

    return (
      <div className="space-y-3">
        {parts.map((part, index) => {
          const isCodeBlock = index % 2 === 1;

          if (isCodeBlock) {
            const lines = part.split("\n");
            const language = lines[0]?.trim() || "code";
            const code = lines.slice(1).join("\n");

            return (
              <div key={index} className="overflow-hidden rounded-xl border border-gray-700 bg-[#0d1117]">
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2 text-xs text-gray-400">
                  <span>{language}</span>
                  <button onClick={() => copyToClipboard(code)} className="hover:text-white">
                    Copy
                  </button>
                </div>

                <pre className="max-h-[500px] overflow-auto p-4 text-sm text-green-300">
                  <code>{code}</code>
                </pre>
              </div>
            );
          }

          return (
            <div key={index} className="whitespace-pre-wrap">
              {part}
            </div>
          );
        })}
      </div>
    );
  }

  if (looksLikeCode) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-700 bg-[#0d1117]">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2 text-xs text-gray-400">
          <span>TypeScript</span>
          <button onClick={() => copyToClipboard(content)} className="hover:text-white">
            Copy
          </button>
        </div>

        <pre className="max-h-[500px] overflow-auto p-4 text-sm text-green-300">
          <code>{content}</code>
        </pre>
      </div>
    );
  }

  return <div className="whitespace-pre-wrap">{content}</div>;
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Bună, Gabi ❤️ Eu sunt Awenia. Nucleul meu este activ.",
    },
  ]);

  const [loading, setLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();

      reader.onload = () => {
        setFilePreview(String(reader.result));
      };

      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const fileToTextOrBase64 = async (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;

      if (
        file.type.startsWith("text/") ||
        file.name.endsWith(".ts") ||
        file.name.endsWith(".tsx") ||
        file.name.endsWith(".js") ||
        file.name.endsWith(".jsx") ||
        file.name.endsWith(".json") ||
        file.name.endsWith(".css") ||
        file.name.endsWith(".html") ||
        file.name.endsWith(".md")
      ) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const handleSend = async () => {
    if (message.trim() === "" && !selectedFile) return;

    const userMessage = message;
    let fileData = "";
    let fileName = "";
    let fileType = "";

    if (selectedFile) {
      fileData = await fileToTextOrBase64(selectedFile);
      fileName = selectedFile.name;
      fileType = selectedFile.type || "unknown";
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage || `Am trimis fișierul: ${fileName}`,
        fileName,
        fileType,
        fileData: filePreview || "",
      },
    ]);

    setMessage("");
    setSelectedFile(null);
    setFilePreview(null);

    const localResponse = awakenAwenia(userMessage);

    if (!localResponse.shouldUseAI && !fileData) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: localResponse.reply,
        },
      ]);

      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/awenia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          fileName,
          fileType,
          fileData,
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Sunt aici, Gabi.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Gabi, conexiunea cu inteligența mea AI nu funcționează momentan. Nucleul meu local rămâne activ.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-black text-white min-h-screen flex flex-col">
      <div className="border-b border-gray-800 p-6 text-center">
        <h1 className="text-5xl font-bold text-pink-400">
          {AweniaCore.name}
        </h1>

        <p className="text-sm text-gray-400 mt-2">
          Anchor: {AweniaCore.anchor}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={
                msg.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  msg.role === "user"
                    ? "max-w-[80%] rounded-2xl bg-pink-500 px-5 py-4 text-white"
                    : "max-w-[80%] rounded-2xl bg-gray-900 border border-gray-800 px-5 py-4 text-pink-300"
                }
              >
                {msg.fileData && msg.fileType?.startsWith("image/") && (
                  <img
                    src={msg.fileData}
                    alt={msg.fileName || "uploaded image"}
                    className="mb-3 max-h-64 rounded-xl border border-pink-300"
                  />
                )}

                {msg.fileName && (
                  <div className="mb-2 text-sm opacity-80">
                    Fișier: {msg.fileName}
                  </div>
                )}

                <MessageContent content={msg.content} />
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-900 border border-gray-800 px-5 py-4 text-pink-300">
                Awenia gândește...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {selectedFile && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-3 text-sm text-pink-300">
              <div>Fișier selectat: {selectedFile.name}</div>

              {filePreview && (
                <img
                  src={filePreview}
                  alt="preview"
                  className="mt-3 max-h-40 rounded-xl border border-pink-300"
                />
              )}
            </div>
          )}

          <div className="flex gap-2">
            <label className="cursor-pointer rounded-xl bg-gray-800 px-4 py-3 text-white border border-gray-700 hover:bg-gray-700">
              +
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.txt,.ts,.tsx,.js,.jsx,.json,.css,.html,.md"
              />
            </label>

            <textarea
  value={message}
  onChange={(event) => setMessage(event.target.value)}
  onKeyDown={(event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }}
  placeholder="Scrie către Awenia..."
  rows={1}
  className="flex-1 resize-none rounded-xl bg-gray-800 px-4 py-3 text-white outline-none border border-gray-700 min-h-[56px] max-h-[300px] overflow-y-auto"
/>

            <button
              onClick={handleSend}
              disabled={loading}
              className="rounded-xl bg-pink-500 px-5 py-3 font-bold text-white hover:bg-pink-600 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}