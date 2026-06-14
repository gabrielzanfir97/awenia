import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";

type CognitiveLayerStatus =
  | "active"
  | "degraded"
  | "needs_attention"
  | "failed";

async function safeRead<T>(
  name: string,
  reader: () => Promise<T>,
  fallback: T
) {
  try {
    return {
      name,
      data: await reader(),
      status: "connected",
      error: null,
    };
  } catch (error: any) {
    return {
      name,
      data: fallback,
      status: "failed",
      error: error?.message || `Failed to read ${name}`,
    };
  }
}

function calculateMemoryLoad(memory: any) {
  const conversations = memory?.memory?.conversations || 0;
  const summaries = memory?.memory?.summaries || 0;

  if (conversations === 0) return 0;

  const compressionRatio = summaries / Math.max(1, conversations);
  const rawLoad = conversations - summaries * 10;

  return Math.max(
    0,
    Math.min(100, Math.round(rawLoad / 5 + (1 - compressionRatio) * 20))
  );
}

function calculateLayerStatus(input: {
  sourceFailures: number;
  awarenessScore: number;
  memoryHealth?: string;
  goalStatus?: string;
}): CognitiveLayerStatus {
  if (input.sourceFailures >= 2) return "failed";

  if (input.sourceFailures === 1) return "degraded";

  if (
    input.awarenessScore < 50 ||
    input.memoryHealth === "degraded" ||
    input.goalStatus === "failed"
  ) {
    return "needs_attention";
  }

  return "active";
}

export async function buildCognitiveArchitecture() {
  const startedAt = new Date().toISOString();

  const awarenessResult = await safeRead(
    "awareness",
    () => buildAwarenessState(),
    {
      awareness: {
        verified: false,
        awarenessScore: 0,
        weakSkills: [],
        pendingUpgrades: [],
        activeGoals: [],
        primaryProblem: "Awareness unavailable",
        recommendedAction: "Repair awareness",
        metrics: {
          sourceFailures: 1,
          weakSkillCount: 0,
          activeGoalCount: 0,
          pendingUpgradeCount: 0,
          memoryAreaCount: 0,
          personalityTraitCount: 0
        },
        active: false,
        confidence: 0,
        systemState: {
          runtime: "",
          memory: "",
          goals: "",
          skills: "",
          evolution: "",
          personality: "",
          protection: ""
        },
        sourceStatuses: {
          memoryStats: "connected",
          autonomousGoals: "connected",
          autonomousPriorities: "connected",
          skillLevels: "connected",
          evolutionSuggestions: "connected",
          personalityTraits: "connected"
        },
        sourceErrors: [],
        memoryStats: [],
        autonomousPriorities: [],
        personalityTraits: [],
        nextPriority: ""
      },
      timestamp: ""
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
        recommendedFocus: "general",
        compressionNeeded: false,
        verified: false,
        readStatuses: {
          memories: "connected",
          summaries: "connected",
          goals: "connected",
          reports: "connected"
        },
        readErrors: [],
        dominantMemoryAreas: [],
        emotionalMemoryMap: [],
        activeGoals: 0,
        strongestArea: "",
        duplicateCount: 0,
        possibleDuplicates: [],
        memoryTimeline: []
      },
      status: "empty",
      continuity: { identity: "", learning: "", optimization: "", protection: "" },
      snapshot: { createdAt: "", memoryHealth: "", strongestArea: "", recommendedFocus: "", totalMemories: 0, totalSummaries: 0, totalGoals: 0, totalReports: 0, compressionNeeded: false, duplicateCount: 0 },
      execution: { startedAt: "", completedAt: "" },
      timestamp: ""
    }
  );

  const goalsResult = await safeRead(
    "goals",
    () => manageAutonomousGoals(),
    {
      goals: [],
      activeGoals: [],
      activeMission: "No active mission",
      nextAction: "Create or review autonomous goals",
      hasRealGoals: false,
      status: "failed",
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
      inactiveGoals: [],
      executionPlan: [],
      health: { hasUrgentGoals: false, hasStalledGoals: false, hasNearCompletionGoals: false, needsNewGoal: false },
      source: { verified: false, status: "unknown", error: null },
      execution: { startedAt: "", completedAt: "" },
      timestamp: ""
    }
  );

  const awareness = awarenessResult.data;
  const memory = memoryResult.data;
  const goals = goalsResult.data;

  const sourceFailures = [
    awarenessResult,
    memoryResult,
    goalsResult,
  ].filter((item) => item.status === "failed").length;

  const awarenessScore = awareness.awareness?.awarenessScore || 0;
  const weakSkills = awareness.awareness?.weakSkills || [];
  const pendingUpgrades =
    awareness.awareness?.pendingUpgrades?.length || 0;
  const activeGoals =
    goals.goalAnalysis?.totalActiveGoals ||
    awareness.awareness?.activeGoals?.length ||
    0;

  const memoryLoad = calculateMemoryLoad(memory);

  const decision = makeAutonomousDecision({
    errors: sourceFailures,
    memoryLoad,
    pendingUpgrades,
    weakSkills,
    activeGoals,
    awarenessScore,
    lastFailureCount: sourceFailures,
  });

  const workflowPlan = coordinateAgents(
    decision.priority,
    `${decision.action}. Reason: ${decision.reason}`
  );

  const status = calculateLayerStatus({
    sourceFailures,
    awarenessScore,
    memoryHealth: memory.memoryAnalysis?.memoryHealth,
    goalStatus: goals.status,
  });

  return {
    architecture: {
      status,

      verified: sourceFailures === 0,

      confidence: Math.max(
        0,
        Math.min(100, awarenessScore - sourceFailures * 15)
      ),

      layers: {
        perception: {
          status: awarenessResult.status,
          source: "awareness",
          score: awarenessScore,
          primaryProblem: awareness.awareness?.primaryProblem,
          recommendedAction: awareness.awareness?.recommendedAction,
        },

        memory: {
          status: memoryResult.status,
          health: memory.memoryAnalysis?.memoryHealth,
          load: memoryLoad,
          recommendedFocus: memory.memoryAnalysis?.recommendedFocus,
          compressionNeeded: memory.memoryAnalysis?.compressionNeeded,
        },

        goals: {
          status: goalsResult.status,
          activeMission: goals.activeMission,
          nextAction: goals.nextAction,
          activeGoals,
          hasRealGoals: goals.hasRealGoals,
        },

        decision: {
          priority: decision.priority,
          action: decision.action,
          reason: decision.reason,
          risk: decision.risk,
          urgency: decision.urgency,
          confidence: decision.confidence,
          secondaryPriorities: decision.secondaryPriorities,
          executionPlan: decision.executionPlan,
        },

        agents: {
          plannedWorkflowId: workflowPlan.workflowId,
          plannedStatus: workflowPlan.status,
          selectedAgents: workflowPlan.activeAgents.map((agent) => ({
            id: agent.id,
            role: agent.role,
            priority: agent.priority,
            status: agent.status,
            confidence: agent.confidence,
          })),
          workflowSteps: workflowPlan.steps,
        },
      },

      cognitiveState: {
        weakSkills,
        pendingUpgrades,
        activeGoals,
        memoryLoad,
        sourceFailures,
        awarenessScore,
      },

      sourceStatus: {
        awareness: awarenessResult.status,
        memory: memoryResult.status,
        goals: goalsResult.status,
      },

      sourceErrors: [
        awarenessResult.error,
        memoryResult.error,
        goalsResult.error,
      ].filter(Boolean),

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },
    },

    timestamp: new Date().toISOString(),
  };
}

export async function optimizeCognitiveArchitecture() {
  const architecture = await buildCognitiveArchitecture();

  return {
    status:
      architecture.architecture.status === "active"
        ? "optimized"
        : "needs_attention",

    architecture,

    optimization: {
      priority:
        architecture.architecture.layers.decision.priority,

      action:
        architecture.architecture.layers.decision.action,

      reason:
        architecture.architecture.layers.decision.reason,

      risk:
        architecture.architecture.layers.decision.risk,

      urgency:
        architecture.architecture.layers.decision.urgency,

      confidence:
        architecture.architecture.layers.decision.confidence,
    },

    timestamp: new Date().toISOString(),
  };
}