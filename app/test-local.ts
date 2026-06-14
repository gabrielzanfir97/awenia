import { callLocalOllama } from "./local-ai-provider";

export async function testLocalAI() {
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

  console.log("LOCAL AI TEST:", response);

  return response;
}

export default testLocalAI;