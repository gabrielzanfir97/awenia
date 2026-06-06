export function shouldCreateMemorySummary(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("rezumă memoria") ||
    lower.includes("rezuma memoria") ||
    lower.includes("compress memory") ||
    lower.includes("memory summary") ||
    lower.includes("rezumat memorie") ||
    lower.includes("summary memory")
  );
}

export function buildMemorySummary(message: string, mainFocus: string) {
  return {
    summary: `Memory compression requested by Gabi: ${message}. Current focus: ${mainFocus}. Keep only essential long-term information for future context.`,
    category: mainFocus || "awenia",
    importance: 8,
  };
}

export function shorten(text: string, max = 350): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export function getMainFocus(priorities: any[]): string {
  const first = priorities.find((item: any) => item.focus !== "general");

  if (!first) return "awenia";

  return first.focus;
}