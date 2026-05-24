import { callLocalOllama } from "./local-ai-provider";

type ProviderName = "ollama" | "cloud";

export async function callAIProvider(prompt: string) {
  const provider: ProviderName =
    (process.env.LOCAL_AI_PROVIDER as ProviderName) || "cloud";

  if (provider === "ollama") {
    return await callLocalOllama(prompt);
  }

  return null;
}