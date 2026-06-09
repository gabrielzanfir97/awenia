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

  return {
    memory: {
      conversations: memories.length,
      summaries: summaries.length,
      goals: goals.length,
      evolutionReports: reports.length,
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

    timestamp: new Date().toISOString(),
  };
}