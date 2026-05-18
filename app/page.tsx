"use client";

import { useState } from "react";
import { AweniaCore } from "./awenia-core";
import { awakenAwenia } from "./orchestrator";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Bună, Gabi ❤️ Eu sunt Awenia. Nucleul meu este activ.",
    },
  ]);

  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (message.trim() === "") return;

    const userMessage = message;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setMessage("");

    const localResponse = awakenAwenia(userMessage);

    if (!localResponse.shouldUseAI) {
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
                msg.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  msg.role === "user"
                    ? "max-w-[80%] rounded-2xl bg-pink-500 px-5 py-4 text-white whitespace-pre-wrap"
                    : "max-w-[80%] rounded-2xl bg-gray-900 border border-gray-800 px-5 py-4 text-pink-300 whitespace-pre-wrap"
                }
              >
                {msg.content}
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
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSend();
              }
            }}
            placeholder="Scrie către Awenia..."
            className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-white outline-none border border-gray-700"
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
    </main>
  );
}