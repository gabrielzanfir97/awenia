import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents, executeAgentWorkflow } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type BackgroundWorkerStatus =
  | "idle"
  | "monitoring"
  | "executed"
  | "needs_attention"
  | "needs_approval"
  | "blocked"
  | "failed";

export type BackgroundWorkerTask = {
  id: string;
  area: string;
  action: string;
  reason: string;
  priority: number;
  risk: "low" | "medium" | "high" | "critical";
  requiresGabiApproval: boolean;
  safeToExecute: boolean;
  status: "planned" | "executed" | "skipped" | "failed";
  result?: any;
};

function createTaskId(area: string) {
  return `background_${area}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function safeRead<T>(
  name: string,
  reader: () => Promise<T>,
  fallback: T
) {
  try {
    const data = await reader();
    const nestedStatus = (data as { status?: unknown } | null)?.status;
    const failed = nestedStatus === "failed" || nestedStatus === "blocked";
    return {
      name,
      data: failed ? fallback : data,
      status: failed ? "failed" : "connected",
      error: failed ? `${name} returned status ${nestedStatus}` : null,
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

  return Math.max(
    0,
    Math.min(100, Math.round((conversations - summaries * 10) / 5))
  );
}

function buildBackgroundTasks(input: {
  awareness: any;
  memory: any;
  goals: any;
  sourceFailures: number;
}) {
  const tasks: BackgroundWorkerTask[] = [];

  const awarenessScore = input.awareness.awareness?.awarenessScore || 0;
  const weakSkills = input.awareness.awareness?.weakSkills || [];
  const pendingUpgrades =
    input.awareness.awareness?.pendingUpgrades?.length || 0;
  const memoryHealth =
    input.memory.memoryAnalysis?.memoryHealth || "unknown";
  const compressionNeeded =
    input.memory.memoryAnalysis?.compressionNeeded === true;
  const activeGoals =
    input.goals.goalAnalysis?.totalActiveGoals ||
    input.awareness.awareness?.activeGoals?.length ||
    0;

  const memoryLoad = calculateMemoryLoad(input.memory);

  if (input.sourceFailures > 0) {
    tasks.push({
      id: createTaskId("source_repair"),
      area: "source_repair",
      action: "Repair failed background worker sources",
      reason: `${input.sourceFailures} sources failed`,
      priority: 10,
      risk: "critical",
      requiresGabiApproval: true,
      safeToExecute: false,
      status: "planned",
    });
  }

  if (awarenessScore < 60) {
    tasks.push({
      id: createTaskId("awareness"),
      area: "awareness",
      action: "Monitor and improve awareness reliability",
      reason: `Awareness score is ${awarenessScore}`,
      priority: 8,
      risk: "high",
      requiresGabiApproval: false,
      safeToExecute: false,
      status: "planned",
    });
  }

  if (
    memoryHealth === "needs_compression" ||
    memoryHealth === "needs_cleanup" ||
    compressionNeeded ||
    memoryLoad >= 70
  ) {
    tasks.push({
      id: createTaskId("memory"),
      area: "memory",
      action: "Plan memory compression and cleanup",
      reason: `Memory health is ${memoryHealth}, load ${memoryLoad}%`,
      priority: 7,
      risk: "medium",
      requiresGabiApproval: false,
      safeToExecute: false,
      status: "planned",
    });
  }

  if (weakSkills.length > 0) {
    tasks.push({
      id: createTaskId("learning"),
      area: "learning",
      action: `Create learning direction for: ${weakSkills.join(", ")}`,
      reason: "Weak skills detected",
      priority: 6,
      risk: "medium",
      requiresGabiApproval: false,
      safeToExecute: false,
      status: "planned",
    });
  }

  if (pendingUpgrades > 0) {
    tasks.push({
      id: createTaskId("upgrade"),
      area: "upgrade",
      action: "Review pending evolution suggestions",
      reason: `${pendingUpgrades} pending upgrades detected`,
      priority: 7,
      risk: "high",
      requiresGabiApproval: true,
      safeToExecute: false,
      status: "planned",
    });
  }

  if (activeGoals === 0) {
    tasks.push({
      id: createTaskId("goals"),
      area: "goals",
      action: "Create or activate a clear autonomous goal",
      reason: "No active goals detected",
      priority: 5,
      risk: "medium",
      requiresGabiApproval: false,
      safeToExecute: false,
      status: "planned",
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: createTaskId("monitoring"),
      area: "monitoring",
      action: "Continue safe background monitoring",
      reason: "No urgent background task detected",
      priority: 2,
      risk: "low",
      requiresGabiApproval: false,
      safeToExecute: true,
      status: "planned",
    });
  }

  return tasks.sort((a, b) => b.priority - a.priority);
}

async function shouldSaveBackgroundSuggestion(task: BackgroundWorkerTask) {
  if (task.priority < 7) return false;

  const recent = await getEvolutionSuggestions(20);

  const signature = `${task.area} ${task.action}`
    .toLowerCase()
    .slice(0, 80);

  return !recent.some((item: any) =>
    `${item.suggestion || ""} ${item.reason || ""}`
      .toLowerCase()
      .includes(signature)
  );
}

function calculateWorkerStatus(primaryTask: BackgroundWorkerTask): BackgroundWorkerStatus {
  if (!primaryTask.safeToExecute && primaryTask.requiresGabiApproval) {
    return "needs_approval";
  }

  if (!primaryTask.safeToExecute && primaryTask.risk === "critical") {
    return "blocked";
  }

  if (primaryTask.risk === "high") {
    return "needs_attention";
  }

  if (primaryTask.area === "monitoring") {
    return "monitoring";
  }

  return "idle";
}

export async function runBackgroundWorker(
  task = "Run safe background worker cycle"
) {
  const startedAt = new Date().toISOString();

  try {
    const awarenessResult = await safeRead(
      "awareness",
      () => buildAwarenessState(),
      {
        awareness: {
          awarenessScore: 0,
          weakSkills: [],
          pendingUpgrades: [],
          activeGoals: [],
          primaryProblem: "Awareness unavailable",
          recommendedAction: "Repair awareness",
          active: false,
          verified: false,
          confidence: 0,
          systemState: {
            runtime: "unknown",
            memory: "unknown",
            goals: "unknown",
            skills: "unknown",
            evolution: "unknown",
            personality: "unknown",
            protection: "unknown"
          },
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
          autonomousPriorities: [],
          personalityTraits: [],
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
          activeGoals: 0,
          evolutionReports: 0,
          criticalMemories: 0
        },
        memoryAnalysis: {
          memoryHealth: "empty",
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
          recommendedFocus: "",
          duplicateCount: 0,
          possibleDuplicates: [],
          memoryTimeline: []
        },
        continuity: {
          identity: "",
          learning: "",
          optimization: "",
          protection: ""
        },
        snapshot: {
          createdAt: "",
          countScope: "recent_sample",
          sampleLimits: {
            memories: 50,
            summaries: 20,
            goals: 20,
            reports: 20,
          },
          databaseReadsVerified: false,
          memoryHealth: "empty",
          strongestArea: "",
          recommendedFocus: "",
          totalMemories: 0,
          totalSummaries: 0,
          totalGoals: 0,
          totalReports: 0,
          compressionNeeded: false,
          duplicateCount: 0
        },
        status: "",
        execution: {
          startedAt: "",
          completedAt: ""
        },
        timestamp: ""
      }
    );

    const goalsResult = await safeRead(
      "goals",
      () => manageAutonomousGoals(),
      {
        activeMission: "No active mission",
        nextAction: "Create or review goals",
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
        hasRealGoals: false,
        goals: [],
        activeGoals: [],
        inactiveGoals: [],
        executionPlan: [],
        health: {
          hasUrgentGoals: false,
          hasStalledGoals: false,
          hasNearCompletionGoals: false,
          needsNewGoal: false,
        },
        status: "",
        source: {
          verified: false,
          status: "unknown",
          error: null,
        },
        execution: {
          startedAt: "",
          completedAt: "",
        },
        timestamp: ""
      }
    );

    const sourceFailures = [
      awarenessResult,
      memoryResult,
      goalsResult,
    ].filter((item) => item.status === "failed").length;

    const sourceErrors = [
      awarenessResult.error,
      memoryResult.error,
      goalsResult.error,
    ].filter(Boolean);

    const tasks = buildBackgroundTasks({
      awareness: awarenessResult.data,
      memory: memoryResult.data,
      goals: goalsResult.data,
      sourceFailures,
    });

    const primaryTask = tasks[0];

    const memoryLoad = calculateMemoryLoad(memoryResult.data);

    const decision = makeAutonomousDecision({
      errors: sourceFailures,
      memoryLoad,
      pendingUpgrades:
        awarenessResult.data.awareness?.pendingUpgrades?.length || 0,
      weakSkills: awarenessResult.data.awareness?.weakSkills || [],
      activeGoals:
        goalsResult.data.goalAnalysis?.totalActiveGoals || 0,
      awarenessScore:
        awarenessResult.data.awareness?.awarenessScore || 0,
      lastFailureCount: sourceFailures,
    });

    const workflowPlan = coordinateAgents(
      decision.priority,
      `${primaryTask.action}. Reason: ${primaryTask.reason}`
    );

    let workflowResult = null;

    if (
      primaryTask.safeToExecute &&
      primaryTask.risk === "low" &&
      primaryTask.requiresGabiApproval === false
    ) {
      workflowResult = await executeAgentWorkflow(
        decision.priority,
        `${primaryTask.action}. Reason: ${primaryTask.reason}`
      );

      primaryTask.status =
        workflowResult.success === true ? "executed" : "failed";

      primaryTask.result = workflowResult;
    } else {
      primaryTask.status = "skipped";
    }

    let reflectionSaved = false;
    let suggestionSaved = false;

    await createAutonomousReflection(
      `Background worker selected task: ${primaryTask.area}`,
      primaryTask.reason,
      primaryTask.action
    );

    reflectionSaved = true;

    if (await shouldSaveBackgroundSuggestion(primaryTask)) {
      await createEvolutionSuggestion(
        `Background worker: ${primaryTask.area}`,
        `${primaryTask.reason}. Recommended action: ${primaryTask.action}`,
        primaryTask.risk === "critical"
          ? 9
          : primaryTask.risk === "high"
            ? 8
            : 6
      );

      suggestionSaved = true;
    }

    const status =
      workflowResult?.success === true
        ? "executed"
        : workflowResult !== null
          ? "needs_attention"
          : calculateWorkerStatus(primaryTask);

    return {
      status,

      backgroundWorker: {
        task,

        meaning:
          "Background worker monitors, plans and executes only safe low-risk actions automatically.",

        primaryTask,

        tasks,

        decision,

        workflowPlan,

        workflowResult,

        sourceStatus: {
          awareness: awarenessResult.status,
          memory: memoryResult.status,
          goals: goalsResult.status,
        },

        sourceErrors,

        reflectionSaved,

        suggestionSaved,

        safeExecution: {
          executedAutomatically: workflowResult?.success === true,
          reason:
            primaryTask.safeToExecute && primaryTask.risk === "low"
              ? "Low-risk task allowed automatic execution"
              : "Task was kept as plan/suggestion because it needs attention or approval",
          requiresGabiApproval: primaryTask.requiresGabiApproval,
          safeToExecute: primaryTask.safeToExecute,
        },

        rules: {
          canMonitor: true,
          canPlan: true,
          canExecuteLowRiskOnly: true,
          canExecuteHighRiskWithoutApproval: false,
          canModifyCodeWithoutApproval: false,
          canInventSystemStatus: false,
        },

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },
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

      backgroundWorker: {
        task,

        meaning:
          "Background worker monitors, plans and executes only safe low-risk actions automatically.",

        primaryTask: {
          id: createTaskId("background_worker"),
          area: "background_worker",
          action: "Repair background-worker.ts or connected systems",
          reason: error?.message || "Background worker failed",
          priority: 10,
          risk: "critical",
          requiresGabiApproval: true,
          safeToExecute: false,
          status: "failed",
        },

        tasks: [],

        workflowPlan: null,

        workflowResult: null,

        sourceStatus: {},

        sourceErrors: [
          error?.message || "Unknown background worker error",
        ],

        rules: {
          canMonitor: true,
          canPlan: true,
          canExecuteLowRiskOnly: true,
          canExecuteHighRiskWithoutApproval: false,
          canModifyCodeWithoutApproval: false,
          canInventSystemStatus: false,
        },

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error: error?.message || "Unknown background worker error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function runBackgroundWorkerCycle(task?: string) {
  return runBackgroundWorker(task);
}

export async function buildBackgroundWorkerState(task?: string) {
  return runBackgroundWorker(task);
}