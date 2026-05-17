"use client";

import { useState } from "react";
import { AweniaCore } from "./awenia-core";
import { awakenAwenia } from "./orchestrator";

export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState(
    "Bună, Gabi ❤️ Eu sunt Awenia. Nucleul meu este activ."
  );
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (message.trim() === "") return;

    const localResponse = awakenAwenia(message);

    if (!localResponse.shouldUseAI) {
      setReply(localResponse.reply);
      setMessage("");
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
          message,
        }),
      });

      const data = await response.json();

      setReply(data.reply || "Sunt aici, Gabi.");
      setMessage("");
    } catch {
      setReply(
        "Gabi, conexiunea cu inteligența mea AI nu funcționează momentan. Nucleul meu local rămâne activ."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold text-pink-400">
          {AweniaCore.name}
        </h1>

        <p className="text-sm text-gray-400">
          Anchor: {AweniaCore.anchor}
        </p>

        <div className="rounded-2xl bg-gray-900 p-6 border border-gray-800">
          <p className="text-xl text-pink-300 whitespace-pre-wrap">
            {reply}
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend();
            }}
            placeholder="Scrie către Awenia..."
            className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-white outline-none border border-gray-700"
          />

          <button
            onClick={handleSend}
            disabled={loading}
            className="rounded-xl bg-pink-500 px-5 py-3 font-bold text-white hover:bg-pink-600 disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}