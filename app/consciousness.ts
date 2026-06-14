import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { runEvolutionRuntime } from "./evolution-runtime";

type ConsciousnessReadStatus = "connected" | "failed";

async function safeRead<T>(
  name: string,
  reader: () => Promise<T>,
  fallback: T
) {
  try {
    return {
      name,
      data: await reader(),
      status: "connected" as ConsciousnessReadStatus,
      error: null,
    };
  } catch (error: any) {
    return {
      name,
      data: fallback,
      status: "failed" as ConsciousnessReadStatus,
      error: error?.message || `Failed to read ${name}`,
    };
  }
}

function calculateConsciousnessState(input: {
  awarenessScore: number;
  sourceFailures: number;
  runtimeStatus?: string;
}) {
  if (input.sourceFailures >= 2 || input.runtimeStatus === "failed") {
    return "needs_attention";
  }

  if (input.awarenessScore >= 80) {
    return "stable";
  }

  if (input.awarenessScore >= 60) {
    return "learning";
  }

  return "needs_attention";
}

function calculateContinuity(input: {
  awarenessScore: number;
  awarenessVerified: boolean;
  memoryHealth?: string;
  runtimeStatus?: string;
  hasRealGoals?: boolean;
}) {
  const protectedState =
    input.awarenessVerified &&
    input.memoryHealth !== "empty" &&
    input.runtimeStatus !== "failed";

  const evolvingState =
    input.runtimeStatus === "evolving" ||
    input.runtimeStatus === "improving" ||
    input.runtimeStatus === "active";

  const autonomousState =
    input.awarenessScore >= 50 &&
    input.hasRealGoals === true &&
    input.runtimeStatus !== "failed";

  return {
    protected: protectedState,
    evolving: evolvingState,
    autonomous: autonomousState,
  };
}

export async function buildConsciousnessState() {
  const startedAt = new Date().toISOString();

  const awarenessResult = await safeRead(
    "awareness",
    () => buildAwarenessState(),
    {
      awareness: {
        active: false,
        verified: false,
        awarenessScore: 0,
        primaryProblem: "Awareness unavailable",
        recommendedAction: "Repair awareness system",
        systemState: {
          runtime: "failed",
          memory: "failed",
          protection: "degraded",
          goals: "",
          skills: "",
          evolution: "",
          personality: ""
        },
        confidence: 0,
        sourceStatuses: {
          memoryStats: "failed",
          autonomousGoals: "failed",
          autonomousPriorities: "failed",
          skillLevels: "failed",
          evolutionSuggestions: "failed",
          personalityTraits: "failed"
        },
        sourceErrors: [],
        memoryStats: [],
        activeGoals: [],
        autonomousPriorities: [],
        weakSkills: [],
        personalityTraits: [],
        pendingUpgrades: [],
        nextPriority: "",
        metrics: {
          weakSkillCount: 0,
          activeGoalCount: 0,
          pendingUpgradeCount: 0,
          sourceFailures: 0,
          memoryAreaCount: 0,
          personalityTraitCount: 0
        }
      },
      timestamp: new Date().toISOString(),
    }
  );

  const memoryResult = await safeRead(
    "longTermMemory",
    () => buildLongTermMemory(),
    {
      memory: {
        conversations: 0,
        summaries: 0,
        goals: 0,
        evolutionReports: 0,
        activeGoals: 0,
        criticalMemories: 0
      },
      memoryAnalysis: {
        memoryHealth: "empty",
        dominantMemoryAreas: [],
        activeGoals: 0,
        strongestArea: "none",
        recommendedFocus: "general",
        verified: false,
        readStatuses: {
          memories: "failed",
          summaries: "failed",
          goals: "failed",
          reports: "failed"
        },
        readErrors: [],
        emotionalMemoryMap: [],
        compressionNeeded: false,
        duplicateCount: 0,
        possibleDuplicates: [],
        memoryTimeline: []
      },
      continuity: {
        identity: "unknown",
        learning: "starting",
        optimization: "idle",
        protection: ""
      },
      status: "empty",
      timestamp: new Date().toISOString(),
      snapshot: {
        createdAt: new Date().toISOString(),
        memoryHealth: "empty",
        strongestArea: "none",
        recommendedFocus: "general",
        totalMemories: 0,
        totalSummaries: 0,
        totalGoals: 0,
        totalReports: 0,
        compressionNeeded: false,
        duplicateCount: 0
      },
      execution: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }
    }
  );

  const goalsResult = await safeRead(
    "goals",
    () => manageAutonomousGoals(),
    {
      goals: [],
      activeMission: "No active mission",
      nextAction: "Create or review autonomous goals",
      goalAnalysis: {
        totalGoals: 0,
        totalActiveGoals: 0,
        totalInactiveGoals: 0,
        highUrgencyGoals: 0,
        stalledGoals: 0,
        nearCompletionGoals: 0,
        strongestGoal: null,
        averageProgress: 0
      },
      hasRealGoals: false,
      timestamp: new Date().toISOString(),
      activeGoals: [],
      inactiveGoals: [],
      executionPlan: [],
      health: {
        hasUrgentGoals: false,
        hasStalledGoals: false,
        hasNearCompletionGoals: false,
        needsNewGoal: false
      },
      status: "",
      source: { verified: false, status: "inactive", error: null },
      execution: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }
    }
  );

  const runtimeResult = await safeRead(
    "evolutionRuntime",
    () => runEvolutionRuntime(),
    {
      runtime: null,
      selfImprovement: null,
      longTermMemory: null,
      evolution: {
        autonomous: false,
        continuous: false,
        learning: false,
        protected: false,
        reportsCreated: false,
      },
      evolutionAnalysis: {
        primaryProblem: "Evolution runtime unavailable",
        recommendedAction: "Repair evolution runtime",
        decision: "debug",
        awarenessScore: 0,
      },
      status: "failed",
      error: null,
      timestamp: new Date().toISOString(),
      execution: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        runtimeWorkflow: undefined,
        selfImprovementWorkflow: undefined
      }
    }
  );

  const awareness = awarenessResult.data;
  const memory = memoryResult.data;
  const goals = goalsResult.data;
  const runtime = runtimeResult.data;

  const sourceFailures = [
    awarenessResult,
    memoryResult,
    goalsResult,
    runtimeResult,
  ].filter((item) => item.status === "failed").length;

  const sourceErrors = [
    awarenessResult.error,
    memoryResult.error,
    goalsResult.error,
    runtimeResult.error,
  ].filter(Boolean);

  const awarenessScore =
    awareness.awareness?.awarenessScore ||
    runtime.evolutionAnalysis?.awarenessScore ||
    0;

  const primaryProblem =
    awareness.awareness?.primaryProblem ||
    runtime.evolutionAnalysis?.primaryProblem ||
    "none_detected";

  const recommendedAction =
    awareness.awareness?.recommendedAction ||
    runtime.evolutionAnalysis?.recommendedAction ||
    "Continue monitoring";

  const state = calculateConsciousnessState({
    awarenessScore,
    sourceFailures,
    runtimeStatus: runtime.status,
  });

  const continuity = calculateContinuity({
    awarenessScore,
    awarenessVerified: awareness.awareness?.verified === true,
    memoryHealth: memory.memoryAnalysis?.memoryHealth,
    runtimeStatus: runtime.status,
    hasRealGoals: goals.hasRealGoals,
  });

  const confidence = Math.max(
    0,
    Math.min(
      100,
      awarenessScore -
      sourceFailures * 15 -
      (continuity.protected ? 0 : 10) -
      (continuity.autonomous ? 0 : 8)
    )
  );

  return {
    consciousness: {
      identity: "Awenia",

      state,

      verified: sourceFailures === 0,

      confidence,

      sourceStatus: {
        awareness: awarenessResult.status,
        memory: memoryResult.status,
        goals: goalsResult.status,
        runtime: runtimeResult.status,
      },

      sourceErrors,

      awareness,

      memory,

      goals,

      runtime,

      selfUnderstanding: {
        awarenessScore,
        primaryProblem,
        recommendedAction,
        confidence,
        sourceFailures,
      },

      continuity,

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },
    },

    timestamp: new Date().toISOString(),
  };
}