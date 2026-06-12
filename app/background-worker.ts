import {
  getRecentMemories,
  getEvolutionSuggestions,
  getAutonomousGoals,
} from "./memory-store";

export async function runBackgroundWorker() {
  const recentMemories =
    await getRecentMemories(10);

  const evolutionSuggestions =
    await getEvolutionSuggestions(10);

  const autonomousGoals =
    await getAutonomousGoals(10);

  const activeGoals =
    autonomousGoals.filter(
      (goal: any) => goal.status === "active"
    );

  const pendingSuggestions =
    evolutionSuggestions.filter(
      (item: any) => item.status === "pending"
    );

  let primaryConcern = "none";

  if (pendingSuggestions.length > 0) {
    primaryConcern =
      "Pending evolution suggestions";
  } else if (activeGoals.length === 0) {
    primaryConcern =
      "No active autonomous goals";
  } else if (recentMemories.length < 3) {
    primaryConcern =
      "Low recent memory activity";
  }

  return {
    status: "active",

    analysis: {
      recentMemories:
        recentMemories.length,

      evolutionSuggestions:
        evolutionSuggestions.length,

      autonomousGoals:
        autonomousGoals.length,

      activeGoals:
        activeGoals.length,

      pendingSuggestions:
        pendingSuggestions.length,

      primaryConcern,
    },

    recommendations: [
      pendingSuggestions.length > 0
        ? "Review pending evolution suggestions"
        : null,

      activeGoals.length === 0
        ? "Create new autonomous goals"
        : null,

      recentMemories.length < 3
        ? "Increase memory activity"
        : null,
    ].filter(Boolean),

    workerState: {
      memoryMonitoring: true,
      goalMonitoring: true,
      evolutionMonitoring: true,
      autonomousAnalysis: true,
    },

    timestamp:
      new Date().toISOString(),
  };
}