export function shouldCreateAutonomousGoal(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("obiectiv nou") ||
    lower.includes("creează obiectiv") ||
    lower.includes("creeaza obiectiv") ||
    lower.includes("goal nou") ||
    lower.includes("new goal") ||
    lower.includes("long term goal") ||
    lower.includes("obiectiv pe termen lung")
  );
}

export function shouldUpdateGoalProgress(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("actualizează progresul") ||
    lower.includes("actualizeaza progresul") ||
    lower.includes("update goal progress") ||
    lower.includes("progres obiectiv") ||
    lower.includes("am progresat") ||
    lower.includes("progress")
  );
}

export function extractProgress(message: string) {
  const match = message.match(/(\d{1,3})\s?%/);

  if (!match) return 10;

  const value = Number(match[1]);

  if (Number.isNaN(value)) return 10;

  return Math.max(0, Math.min(100, value));
}

export function buildAutonomousGoal(message: string) {
  return {
    goal: `Long-term goal from Gabi: ${message}`,
    description:
      "Persistent autonomous goal created from Gabi's instruction. Awenia should track this goal over time and use it to guide future evolution.",
    priority: 8,
  };
}