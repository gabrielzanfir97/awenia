export async function callLocalOllama(prompt: string) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2:3b",
        prompt,
        stream: false,
      }),
    });

    const data = await response.json();

    return data.response || "No response from Ollama.";
  } catch (error) {
    console.error("LOCAL OLLAMA ERROR:", error);

    return "Local Ollama error.";
  }
}