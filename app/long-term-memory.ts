import {
  getRecentMemories,
  getMemorySummaries,
  getAutonomousGoals,
  getEvolutionReports,
} from "./memory-store";

export async function buildLongTermMemory() {
  const memories = await getRecentMemories(50);
  const summaries = await getMemorySummaries(20);
  const goals = await getAutonomousGoals(20);
  const reports = await getEvolutionReports(20);

  const strongestCategories: Record<string, number> = {};

  for (const memory of memories) {
    const category =
      memory.category || "general";

    strongestCategories[category] =
      (strongestCategories[category] || 0) + 1;
  }

  const dominantMemoryAreas =
    Object.entries(strongestCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category,
        count,
      }));

  const activeGoals =
    goals.filter(
      (goal: any) =>
        goal.status === "active"
    ).length;

  const memoryHealth =
    memories.length > 0 &&
    summaries.length > 0
      ? "healthy"
      : memories.length > 0
      ? "partial"
      : "empty";

  return {
    memory: {
      conversations: memories.length,
      summaries: summaries.length,
      goals: goals.length,
      evolutionReports: reports.length,
    },

    memoryAnalysis: {
      memoryHealth,

      dominantMemoryAreas,

      activeGoals,

      strongestArea:
        dominantMemoryAreas[0]?.category ||
        "none",

      recommendedFocus:
        dominantMemoryAreas[0]?.category ||
        "general",
    },

    continuity: {
      identity: "persistent",

      learning:
        summaries.length > 0
          ? "continuous"
          : "starting",

      optimization:
        reports.length > 0
          ? "active"
          : "idle",
    },

    status:
      memories.length > 0
        ? "stable"
        : "empty",

    timestamp:
      new Date().toISOString(),
  };
}