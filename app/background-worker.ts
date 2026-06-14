import {
  getRecentMemories,
  getEvolutionSuggestions,
  getAutonomousGoals,
  createAutonomousReflection,
} from "./memory-store";

type WorkerRisk = "low" | "medium" | "high";

export async function runBackgroundWorker() {
  const recentMemories = await getRecentMemories(10);
  const evolutionSuggestions = await getEvolutionSuggestions(10);
  const autonomousGoals = await getAutonomousGoals(10);

  const activeGoals = autonomousGoals.filter(
    (goal: any) => goal.status === "active"
  );

  const pendingSuggestions = evolutionSuggestions.filter(
    (item: any) => item.status === "pending"
  );

  const concerns: string[] = [];
  const recommendations: string[] = [];

  if (pendingSuggestions.length > 0) {
    concerns.push("pending_evolution_suggestions");
    recommendations.push("Review pending evolution suggestions");
  }

  if (activeGoals.length === 0) {
    concerns.push("no_active_autonomous_goals");
    recommendations.push("Create or activate autonomous goals");
  }

  if (recentMemories.length < 3) {
    concerns.push("low_recent_memory_activity");
    recommendations.push("Increase meaningful memory activity");
  }

  let risk: WorkerRisk = "low";

  if (concerns.length >= 3) {
    risk = "high";
  } else if (concerns.length >= 1) {
    risk = "medium";
  }

  const primaryConcern =
    concerns.length > 0 ? concerns[0] : "none";

  const nextAction =
    recommendations.length > 0
      ? recommendations[0]
      : "Continue monitoring";

  const shouldCreateReflection = primaryConcern !== "none";

  if (shouldCreateReflection) {
    await createAutonomousReflection(
      `Background Worker V2 detected: ${primaryConcern}`,
      primaryConcern,
      nextAction
    );
  }

  return {
    system: "Awenia Background Worker V2",
    status: concerns.length === 0 ? "stable" : "active",

    analysis: {
      recentMemories: recentMemories.length,
      evolutionSuggestions: evolutionSuggestions.length,
      autonomousGoals: autonomousGoals.length,
      activeGoals: activeGoals.length,
      pendingSuggestions: pendingSuggestions.length,
      primaryConcern,
      concerns,
      risk,
    },

    recommendations,
    nextAction,

    workerState: {
      memoryMonitoring: true,
      goalMonitoring: true,
      evolutionMonitoring: true,
      autonomousAnalysis: true,
      reflectionCreated: shouldCreateReflection,
    },

    timestamp: new Date().toISOString(),
  };
}