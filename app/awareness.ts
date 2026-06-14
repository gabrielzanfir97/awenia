import {
  getAutonomousGoals,
  getAutonomousPriorities,
  getMemoryCategoryStats,
  getSkillLevels,
  getEvolutionSuggestions,
  getPersonalityTraits,
} from "./memory-store";

type AwarenessSourceStatus = "connected" | "empty" | "failed";

type SafeResult<T> = {
  data: T;
  status: AwarenessSourceStatus;
  error?: string;
};

async function safeRead<T>(
  reader: () => Promise<T>,
  fallback: T
): Promise<SafeResult<T>> {
  try {
    const data = await reader();

    const isEmptyArray = Array.isArray(data) && data.length === 0;

    return {
      data,
      status: isEmptyArray ? "empty" : "connected",
    };
  } catch (error: any) {
    return {
      data: fallback,
      status: "failed",
      error: error?.message || "Unknown awareness read error",
    };
  }
}

function calculateAwarenessScore(input: {
  weakSkills: string[];
  pendingUpgrades: any[];
  activeGoals: any[];
  sourceFailures: number;
  memoryConnected: boolean;
  personalityTraits: any[];
}) {
  let score = 100;

  score -= input.weakSkills.length * 8;
  score -= input.pendingUpgrades.length * 2;
  score -= input.sourceFailures * 15;

  if (!input.memoryConnected) {
    score -= 25;
  }

  if (input.activeGoals.length === 0) {
    score -= 10;
  }

  if (input.personalityTraits.length === 0) {
    score -= 8;
  }

  return Math.max(0, Math.min(100, score));
}

function detectPrimaryProblem(input: {
  weakSkills: string[];
  pendingUpgrades: any[];
  activeGoals: any[];
  sourceFailures: number;
}) {
  if (input.sourceFailures > 0) {
    return "One or more awareness data sources failed";
  }

  if (input.weakSkills.length > 0) {
    return `Weak skills detected: ${input.weakSkills.join(", ")}`;
  }

  if (input.pendingUpgrades.length > 0) {
    return "Pending evolution suggestions need review";
  }

  if (input.activeGoals.length === 0) {
    return "No active goals detected";
  }

  return "none_detected";
}

function detectRecommendedAction(input: {
  weakSkills: string[];
  pendingUpgrades: any[];
  activeGoals: any[];
  sourceFailures: number;
}) {
  if (input.sourceFailures > 0) {
    return "Repair failed awareness sources before increasing autonomy";
  }

  if (input.weakSkills.includes("coding")) {
    return "Improve coding ability using real project files";
  }

  if (input.pendingUpgrades.length > 0) {
    return "Review evolution suggestions";
  }

  if (input.activeGoals.length > 0) {
    return `Continue goal: ${input.activeGoals[0].goal}`;
  }

  return "Create or review autonomous goals";
}

export async function buildAwarenessState() {
  const memoryStatsResult = await safeRead(
    () => getMemoryCategoryStats(),
    { _total: 0, _source: "", _timestamp: "" }
  );

  const autonomousGoalsResult = await safeRead(
    () => getAutonomousGoals(10),
    []
  );

  const autonomousPrioritiesResult = await safeRead(
    () => getAutonomousPriorities(5),
    []
  );

  const skillLevelsResult = await safeRead(
    () => getSkillLevels(10),
    []
  );

  const evolutionSuggestionsResult = await safeRead(
    () => getEvolutionSuggestions(10),
    []
  );

  const personalityTraitsResult = await safeRead(
    () => getPersonalityTraits(10),
    []
  );

  const memoryStats: any[] = Array.isArray(memoryStatsResult.data) ? memoryStatsResult.data : [];
  const autonomousGoals: any[] = autonomousGoalsResult.data;
  const autonomousPriorities: any[] =
    autonomousPrioritiesResult.data;
  const skillLevels: any[] = skillLevelsResult.data;
  const evolutionSuggestions: any[] =
    evolutionSuggestionsResult.data;
  const personalityTraits: any[] =
    personalityTraitsResult.data;

  const sourceStatuses = {
    memoryStats: memoryStatsResult.status,
    autonomousGoals: autonomousGoalsResult.status,
    autonomousPriorities: autonomousPrioritiesResult.status,
    skillLevels: skillLevelsResult.status,
    evolutionSuggestions: evolutionSuggestionsResult.status,
    personalityTraits: personalityTraitsResult.status,
  };

  const sourceErrors = [
    memoryStatsResult.error,
    autonomousGoalsResult.error,
    autonomousPrioritiesResult.error,
    skillLevelsResult.error,
    evolutionSuggestionsResult.error,
    personalityTraitsResult.error,
  ].filter(Boolean);

  const sourceFailures = Object.values(sourceStatuses).filter(
    (status) => status === "failed"
  ).length;

  const weakSkills = skillLevels
    .filter((skill: any) => (skill.level || 1) <= 1)
    .map((skill: any) => skill.skill)
    .filter(Boolean);

  const activeGoals = autonomousGoals
    .filter((goal: any) => goal.status === "active")
    .map((goal: any) => ({
      id: goal.id,
      goal: goal.goal,
      priority: goal.priority || 5,
      progress: goal.progress || 0,
      status: goal.status,
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
      averageImportance: item.averageImportance,
    }));

  const primaryProblem = detectPrimaryProblem({
    weakSkills,
    pendingUpgrades,
    activeGoals,
    sourceFailures,
  });

  const recommendedAction = detectRecommendedAction({
    weakSkills,
    pendingUpgrades,
    activeGoals,
    sourceFailures,
  });

  const awarenessScore = calculateAwarenessScore({
    weakSkills,
    pendingUpgrades,
    activeGoals,
    sourceFailures,
    memoryConnected: memoryStatsResult.status === "connected",
    personalityTraits,
  });

  const verified = sourceFailures === 0;

  return {
    awareness: {
      active: verified || sourceFailures < 6,

      verified,

      confidence: verified
        ? awarenessScore
        : Math.max(0, awarenessScore - sourceFailures * 10),

      systemState: {
        runtime:
          sourceFailures === 0
            ? "active"
            : sourceFailures < 3
              ? "degraded"
              : "needs_attention",

        memory:
          memoryStatsResult.status === "connected"
            ? "connected"
            : memoryStatsResult.status === "empty"
              ? "empty"
              : "failed",

        goals:
          autonomousGoalsResult.status === "connected"
            ? "connected"
            : autonomousGoalsResult.status === "empty"
              ? "empty"
              : "failed",

        skills:
          skillLevelsResult.status === "connected"
            ? "connected"
            : skillLevelsResult.status === "empty"
              ? "empty"
              : "failed",

        evolution:
          pendingUpgrades.length > 0
            ? "suggestions_pending"
            : evolutionSuggestionsResult.status === "failed"
              ? "failed"
              : "stable",

        personality:
          personalityTraitsResult.status === "connected"
            ? "connected"
            : personalityTraitsResult.status === "empty"
              ? "empty"
              : "failed",

        protection:
          sourceFailures === 0 ? "enabled" : "degraded",
      },

      sourceStatuses,

      sourceErrors,

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
        status: item.status,
      })),

      primaryProblem,

      recommendedAction,

      awarenessScore,

      nextPriority: recommendedAction,

      metrics: {
        weakSkillCount: weakSkills.length,
        activeGoalCount: activeGoals.length,
        pendingUpgradeCount: pendingUpgrades.length,
        sourceFailures,
        memoryAreaCount: strongestMemoryAreas.length,
        personalityTraitCount: personalityTraits.length,
      },
    },

    timestamp: new Date().toISOString(),
  };
}