import { NextResponse } from "next/server";
import { callLocalOllama } from "@/app/local-ai-provider";

export async function GET() {
  const response = await callLocalOllama([
    {
      role: "system",
      content: "Răspunde foarte scurt.",
    },
    {
      role: "user",
      content: "Say only this: LOCAL AI WORKS",
    },
  ]);

  return NextResponse.json({
    status: "completed",
    test: "local_ai",
    response,
    timestamp: new Date().toISOString(),
  });
}