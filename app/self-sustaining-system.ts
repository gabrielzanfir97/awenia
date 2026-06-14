import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { runAutonomousRuntime } from "./autonomous-runtime";
import { runSelfImprovementCycle } from "./self-improvement";
import { runGlobalCognition } from "./global-cognition";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type SelfSustainingStatus =
  | "stable"
  | "monitoring"
  | "repairing"
  | "needs_approval"
  | "needs_attention"
  | "blocked"
  | "failed";

export type SustainTarget = {
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  score: number;
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresGabiApproval: boolean;
  safeToContinue: boolean;
};

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

function getPriority(score: number): SustainTarget["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: SustainTarget[],
  target: Omit<SustainTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

function buildSustainTargets(input: {
  awareness: any;
  memory: any;
  goals: any;
  autonomousRuntime: any;
  selfImprovement: any;
  globalCognition: any;
  sourceFailures: number;
}) {
  const targets: SustainTarget[] = [];

  const awarenessScore =
    input.awareness.awareness?.awarenessScore || 0;

  const memoryHealth =
    input.memory.memoryAnalysis?.memoryHealth || "unknown";

  const activeGoals =
    input.goals.goalAnalysis?.totalActiveGoals || 0;

  if (input.sourceFailures > 0) {
    addTarget(targets, {
      area: "source_repair",
      score: 100,
      reason: `${input.sourceFailures} self-sustaining sources failed`,
      action: "Repair failed sources before autonomous continuation",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (input.globalCognition.status === "blocked") {
    addTarget(targets, {
      area: "global_cognition_blocked",
      score: 100,
      reason: "Global cognition is blocked by safety rules",
      action: "Stop autonomous escalation and wait for Gabi approval",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (
    input.globalCognition.status === "needs_approval" ||
    input.globalCognition.globalCognition?.requiresGabiApproval === true
  ) {
    addTarget(targets, {
      area: "gabi_approval",
      score: 95,
      reason: "Current self-sustaining path requires Gabi approval",
      action: "Prepare approval request instead of executing automatically",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (awarenessScore < 60) {
    addTarget(targets, {
      area: "awareness",
      score: 80,
      reason: `Awareness score is low: ${awarenessScore}`,
      action: "Improve awareness reliability before deeper autonomy",
      risk: "high",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  if (
    memoryHealth === "degraded" ||
    memoryHealth === "needs_compression" ||
    memoryHealth === "needs_cleanup"
  ) {
    addTarget(targets, {
      area: "memory",
      score: 75,
      reason: `Memory health is ${memoryHealth}`,
      action: "Repair, compress or clean long-term memory",
      risk: "medium",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  if (activeGoals === 0) {
    addTarget(targets, {
      area: "goals",
      score: 55,
      reason: "No active autonomous goals detected",
      action: "Create or activate a clear goal before self-sustaining work",
      risk: "medium",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  if (input.autonomousRuntime.status === "failed") {
    addTarget(targets, {
      area: "autonomous_runtime",
      score: 90,
      reason: "Autonomous runtime failed",
      action: "Repair autonomous runtime before continuing",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (input.selfImprovement.status === "failed") {
    addTarget(targets, {
      area: "self_improvement",
      score: 85,
      reason: "Self-improvement cycle failed",
      action: "Repair self-improvement before continuing autonomy",
      risk: "high",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "self_sustaining_monitoring",
      score: 25,
      reason: "No urgent self-sustaining issue detected",
      action: "Continue monitoring with memory, awareness and approval gates",
      risk: "low",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function buildSustainPlan(targets: SustainTarget[]) {
  return targets.slice(0, 5).map((target, index) => ({
    step: index + 1,
    area: target.area,
    priority: target.priority,
    action: target.action,
    reason: target.reason,
    risk: target.risk,
    requiresGabiApproval: target.requiresGabiApproval,
    safeToContinue: target.safeToContinue,
  }));
}

function calculateStatus(primary: SustainTarget): SelfSustainingStatus {
  if (!primary.safeToContinue) return "blocked";
  if (primary.requiresGabiApproval) return "needs_approval";
  if (primary.risk === "critical") return "needs_approval";
  if (primary.risk === "high") return "needs_attention";
  if (primary.area === "self_sustaining_monitoring") return "stable";

  return "repairing";
}

async function shouldSaveSustainSuggestion(target: SustainTarget) {
  if (target.priority === "low") return false;

  const recent = await getEvolutionSuggestions(20);

  const signature = `${target.area} ${target.action}`
    .toLowerCase()
    .slice(0, 80);

  return !recent.some((item: any) =>
    `${item.suggestion || ""} ${item.reason || ""}`
      .toLowerCase()
      .includes(signature)
  );
}

export async function runSelfSustainingSystem(
  task = "Analyze self-sustaining system state for Awenia"
) {
  const startedAt = new Date().toISOString();

  try {
    const awarenessResult = await safeRead(
      "awareness",
      () => buildAwarenessState(),
      {
        awareness: {
          awarenessScore: 0,
          primaryProblem: "Awareness unavailable",
          recommendedAction: "Repair awareness",
          active: false,
          verified: false,
          confidence: 0,
          systemState: { runtime: "", memory: "", goals: "", skills: "", evolution: "", personality: "", protection: "" },
          sourceStatuses: { memoryStats: { status: "disconnected" as const }, autonomousGoals: { status: "disconnected" as const }, autonomousPriorities: { status: "disconnected" as const }, skillLevels: { status: "disconnected" as const }, evolutionSuggestions: { status: "disconnected" as const }, personalityTraits: { status: "disconnected" as const } },
          sourceErrors: [],
          memoryStats: [],
          activeGoals: [],
          autonomousPriorities: [],
          weakSkills: [],
          personalityTraits: [],
          pendingUpgrades: [],
          nextPriority: "",
          metrics: { weakSkillCount: 0, activeGoalCount: 0, pendingUpgradeCount: 0, sourceFailures: 0, memoryAreaCount: 0, personalityTraitCount: 0 }
        },
      } as any
    );

    const memoryResult = await safeRead(
      "longTermMemory",
      () => buildLongTermMemory(),
      {
        memoryAnalysis: {
          memoryHealth: "empty",
          verified: false,
          readStatuses: { memories: { status: "disconnected", recordCount: 0 }, summaries: { status: "disconnected", recordCount: 0 }, goals: { status: "disconnected", recordCount: 0 }, reports: { status: "disconnected", recordCount: 0 } },
          readErrors: [],
          dominantMemoryAreas: [],
          emotionalMemoryMap: [],
          activeGoals: 0,
          strongestArea: "",
          recommendedFocus: "",
          compressionNeeded: false,
          duplicateCount: 0,
          possibleDuplicates: [],
          memoryTimeline: []
        },
      } as any
    );

    const goalsResult = await safeRead(
      "goals",
      () => manageAutonomousGoals(),
      {
        activeMission: "No active mission",
        nextAction: "Create or review goals",
        hasRealGoals: false,
        goalAnalysis: {
          totalGoals: 0,
          totalActiveGoals: 0,
          totalInactiveGoals: 0,
          highUrgencyGoals: 0,
          stalledGoals: 0,
          nearCompletionGoals: 0,
          strongestGoal: null,
          averageProgress: 0,
        },
        goals: [],
        activeGoals: [],
        inactiveGoals: [],
        executionPlan: [],
        health: undefined,
        status: "",
        source: undefined,
        execution: undefined,
        timestamp: ""
      } as any
    );

    const autonomousRuntimeResult = await safeRead(
      "autonomousRuntime",
      () => runAutonomousRuntime(),
      {
        status: "failed",
        runtime: {
          autonomous: false,
          monitoring: false,
          learning: false,
          selfImprovement: false,
          actionTaken: false,
        },
        runtimeAnalysis: undefined,
        execution: undefined,
        timestamp: ""
      } as any
    );

    const selfImprovementResult = await safeRead(
      "selfImprovement",
      () => runSelfImprovementCycle(),
      {
        status: "failed",
        execution: undefined,
        timestamp: ""
      } as any
    );

    const globalCognitionResult = await safeRead(
      "globalCognition",
      () => runGlobalCognition(task),
      {
        status: "failed",
        globalCognition: {
          task: "",
          meaning: "",
          primaryTarget: { area: "", priority: "", score: 0, reason: "", action: "", risk: "", requiresGabiApproval: false, safeToContinue: false },
          targets: [],
          reasonsForCheck: [],
          safeToContinue: false,
          requiresGabiApproval: true,
          recursionBlocked: false,
          controlledByGabi: false,
        },
      } as any
    );

    const sourceFailures = [
      awarenessResult,
      memoryResult,
      goalsResult,
      autonomousRuntimeResult,
      selfImprovementResult,
      globalCognitionResult,
    ].filter((item) => item.status === "failed").length;

    const sourceErrors = [
      awarenessResult.error,
      memoryResult.error,
      goalsResult.error,
      autonomousRuntimeResult.error,
      selfImprovementResult.error,
      globalCognitionResult.error,
    ].filter(Boolean);

    const targets = buildSustainTargets({
      awareness: awarenessResult.data,
      memory: memoryResult.data,
      goals: goalsResult.data,
      autonomousRuntime: autonomousRuntimeResult.data,
      selfImprovement: selfImprovementResult.data,
      globalCognition: globalCognitionResult.data,
      sourceFailures,
    });

    const primaryTarget = targets[0];

    const sustainPlan = buildSustainPlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    let suggestionSaved = false;

    if (await shouldSaveSustainSuggestion(primaryTarget)) {
      await createEvolutionSuggestion(
        `Self-sustaining system: ${primaryTarget.area}`,
        `${primaryTarget.reason}. Recommended action: ${primaryTarget.action}`,
        primaryTarget.priority === "critical"
          ? 9
          : primaryTarget.priority === "high"
            ? 8
            : 6
      );

      suggestionSaved = true;
    }

    const status = calculateStatus(primaryTarget);

    return {
      status,

      selfSustainingSystem: {
        task,

        meaning:
          "Self-sustaining means monitoring, repairing and suggesting safely, not uncontrolled self-modification.",

        primaryTarget,

        targets,

        sustainPlan,

        workflowPlan,

        suggestionSaved,

        awareness: awarenessResult.data,

        memory: memoryResult.data,

        goals: goalsResult.data,

        autonomousRuntime: autonomousRuntimeResult.data,

        selfImprovement: selfImprovementResult.data,

        globalCognition: globalCognitionResult.data,

        sourceStatus: {
          awareness: awarenessResult.status,
          memory: memoryResult.status,
          goals: goalsResult.status,
          autonomousRuntime: autonomousRuntimeResult.status,
          selfImprovement: selfImprovementResult.status,
          globalCognition: globalCognitionResult.status,
        },

        sourceErrors,

        requiresGabiApproval:
          primaryTarget.requiresGabiApproval ||
          primaryTarget.risk === "high" ||
          primaryTarget.risk === "critical",

        safeToContinue:
          primaryTarget.safeToContinue &&
          primaryTarget.risk !== "critical",

        controlledByGabi: true,

        rules: {
          canMonitor: true,
          canSuggestRepairs: true,
          canExecuteHighRiskWithoutApproval: false,
          canInventSystemStatus: false,
          mustUseMemoryBeforeAction: true,
          mustReportResults: true,
        },

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence:
          awarenessResult.data.awareness?.confidence ||
          globalCognitionResult.data.globalCognition?.confidence ||
          0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: "failed",

      selfSustainingSystem: {
        task,

        meaning:
          "Self-sustaining means monitoring, repairing and suggesting safely, not uncontrolled self-modification.",

        primaryTarget: {
          area: "self_sustaining_system",
          priority: "critical",
          score: 100,
          reason:
            error?.message || "Self-sustaining system failed",
          action:
            "Repair self-sustaining-system.ts or connected systems",
          risk: "critical",
          requiresGabiApproval: true,
          safeToContinue: false,
        },

        targets: [],

        sustainPlan: [],

        workflowPlan: null,

        suggestionSaved: false,

        sourceStatus: {},

        sourceErrors: [
          error?.message || "Unknown self-sustaining system error",
        ],

        requiresGabiApproval: true,

        safeToContinue: false,

        controlledByGabi: true,

        rules: {
          canMonitor: true,
          canSuggestRepairs: true,
          canExecuteHighRiskWithoutApproval: false,
          canInventSystemStatus: false,
          mustUseMemoryBeforeAction: true,
          mustReportResults: true,
        },

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence: 0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error:
        error?.message || "Unknown self-sustaining system error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildSelfSustainingSystem(task?: string) {
  return runSelfSustainingSystem(task);
}

export async function analyzeSelfSustainingSystem(task?: string) {
  return runSelfSustainingSystem(task);
}

export async function runSelfSustainingFramework(task?: string) {
  return runSelfSustainingSystem(task);
}