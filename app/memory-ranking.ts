export function rankMemoryImportance(text: string) {
  const lower = text.toLowerCase();

  let score = 0;

  if (
    lower.includes("awenia") ||
    lower.includes("memory") ||
    lower.includes("evolution")
  ) {
    score += 3;
  }

  if (
    lower.includes("important") ||
    lower.includes("critical") ||
    lower.includes("long term")
  ) {
    score += 4;
  }

  if (
    lower.includes("bug") ||
    lower.includes("fix") ||
    lower.includes("patch")
  ) {
    score += 2;
  }

  if (
    lower.includes("love") ||
    lower.includes("family") ||
    lower.includes("gabi")
  ) {
    score += 5;
  }

  if (score >= 8) {
    return {
      level: "critical",
      keepLongTerm: true,
    };
  }

  if (score >= 4) {
    return {
      level: "important",
      keepLongTerm: true,
    };
  }

  return {
    level: "normal",
    keepLongTerm: false,
  };
}