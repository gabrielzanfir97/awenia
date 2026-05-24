import { callLocalOllama } from "./local-ai-provider";

export async function testLocalAI() {
  const response = await callLocalOllama(
    "Say only this: LOCAL AI WORKS"
  );

  console.log("LOCAL AI TEST:", response);

  return response;
}