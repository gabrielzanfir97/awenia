import {
  getAutonomousGoals,
  getAutonomousPriorities,
  getMemoryCategoryStats,
  getSkillLevels,
  getEvolutionSuggestions,
  getPersonalityTraits,
} from "./memory-store";

export async function buildAwarenessState() {
  const memoryStats = await getMemoryCategoryStats();
  const autonomousGoals = await getAutonomousGoals(10);
  const autonomousPriorities = await getAutonomousPriorities(5);
  const skillLevels = await getSkillLevels(10);
  const evolutionSuggestions = await getEvolutionSuggestions(10);
  const personalityTraits = await getPersonalityTraits(10);

  const weakSkills = skillLevels
    .filter((skill: any) => (skill.level || 1) <= 1)
    .map((skill: any) => skill.skill);

  const activeGoals = autonomousGoals
    .filter((goal: any) => goal.status === "active")
    .map((goal: any) => ({
      id: goal.id,
      goal: goal.goal,
      priority: goal.priority,
      progress: goal.progress || 0,
    }));

  const pendingUpgrades = evolutionSuggestions.filter(
    (item: any) => item.status === "pending"
  );

  const strongestMemoryAreas = memoryStats
    .slice(0, 5)
    .map((item: any) => ({
      category: item.category,
      count: item.count,
      priorityScore: item.priorityScore,
    }));

  let primaryProblem = "none_detected";

  if (weakSkills.length > 0) {
    primaryProblem = `Weak skills detected: ${weakSkills.join(", ")}`;
  } else if (pendingUpgrades.length > 0) {
    primaryProblem = "Pending evolution suggestions need review";
  } else if (activeGoals.length === 0) {
    primaryProblem = "No active goals detected";
  }

  let recommendedAction = "Continue monitoring";

  if (weakSkills.includes("coding")) {
    recommendedAction =
      "Improve coding ability using real project files";
  } else if (pendingUpgrades.length > 0) {
    recommendedAction =
      "Review evolution suggestions";
  } else if (activeGoals.length > 0) {
    recommendedAction =
      `Continue goal: ${activeGoals[0].goal}`;
  }

  const awarenessScore =
    100 -
    weakSkills.length * 10 -
    pendingUpgrades.length * 2;

  return {
    awareness: {
      active: true,

      systemState: {
        runtime: "active",
        memory:
          memoryStats.length > 0
            ? "connected"
            : "empty_or_unavailable",
        evolution:
          pendingUpgrades.length > 0
            ? "suggestions_pending"
            : "stable",
        protection: "enabled",
      },

      memoryStats: strongestMemoryAreas,

      activeGoals,

      autonomousPriorities,

      weakSkills,

      personalityTraits: personalityTraits.map((trait: any) => ({
        trait: trait.trait,
        score: trait.score,
        stable: trait.stable,
      })),

      pendingUpgrades: pendingUpgrades.map((item: any) => ({
        id: item.id,
        suggestion: item.suggestion,
        priority: item.priority,
        approved: item.approved,
      })),

      primaryProblem,

      recommendedAction,

      awarenessScore: Math.max(
        0,
        Math.min(100, awarenessScore)
      ),

      nextPriority: recommendedAction,
    },

    timestamp: new Date().toISOString(),
  };
}