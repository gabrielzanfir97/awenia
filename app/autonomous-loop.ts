import { runBackgroundWorker } from "./background-worker";
import { runSelfSustainingSystem } from "./self-sustaining-system";
import { runOmniscientCognition } from "./omniscient-cognition";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type AutonomousLoopStatus =
  | "idle"
  | "running"
  | "completed"
  | "monitoring"
  | "needs_approval"
  | "needs_attention"
  | "blocked"
  | "failed";

export type AutonomousLoopTarget = {
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  score: number;
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresGabiApproval: boolean;
  safeToContinue: boolean;
};

let autonomousLoopRunning = false;

async function safeRead(
  name: string,
  reader: () => Promise<any>,
  fallback: any
) {
  try {
    const data = await reader();
    const nestedStatus = (data as { status?: unknown } | null)?.status;
    if (nestedStatus === "failed" || nestedStatus === "blocked") {
      return {
        name,
        data,
        status: "failed",
        error: `${name} returned ${nestedStatus}`,
      };
    }
    return {
      name,
      data,
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

function getPriority(score: number): AutonomousLoopTarget["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: AutonomousLoopTarget[],
  target: Omit<AutonomousLoopTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

function buildLoopTargets(input: {
  backgroundWorker: any;
  selfSustaining: any;
  omniscient: any;
  sourceFailures: number;
}) {
  const targets: AutonomousLoopTarget[] = [];

  if (input.sourceFailures > 0) {
    addTarget(targets, {
      area: "loop_source_repair",
      score: 100,
      reason: `${input.sourceFailures} autonomous loop sources failed`,
      action: "Repair failed loop sources before continuing",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (
    input.backgroundWorker.status === "failed" ||
    input.selfSustaining.status === "failed" ||
    input.omniscient.status === "failed"
  ) {
    addTarget(targets, {
      area: "loop_failure",
      score: 100,
      reason: "One autonomous loop subsystem failed",
      action: "Stop loop and repair failed subsystem",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (
    input.selfSustaining.status === "blocked" ||
    input.omniscient.status === "blocked"
  ) {
    addTarget(targets, {
      area: "loop_blocked",
      score: 100,
      reason: "Autonomous loop is blocked by safety rules",
      action: "Stop autonomous loop and wait for Gabi approval",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (
    input.backgroundWorker.status === "needs_approval" ||
    input.selfSustaining.status === "needs_approval" ||
    input.omniscient.status === "needs_approval"
  ) {
    addTarget(targets, {
      area: "gabi_approval",
      score: 95,
      reason: "Autonomous loop detected an action requiring Gabi approval",
      action: "Prepare approval request instead of automatic execution",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (
    input.backgroundWorker.status === "needs_attention" ||
    input.selfSustaining.status === "needs_attention" ||
    input.omniscient.status === "needs_verification"
  ) {
    addTarget(targets, {
      area: "loop_attention",
      score: 80,
      reason: "Autonomous loop needs verification or attention",
      action: "Keep loop in monitoring mode and avoid risky execution",
      risk: "high",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  if (input.backgroundWorker.status === "executed") {
    addTarget(targets, {
      area: "background_execution",
      score: 55,
      reason: "Background worker executed a safe low-risk task",
      action: "Record result and continue monitoring",
      risk: "low",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "autonomous_monitoring",
      score: 20,
      reason: "No urgent autonomous loop issue detected",
      action: "Continue safe monitoring without high-risk execution",
      risk: "low",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function buildLoopPlan(targets: AutonomousLoopTarget[]) {
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

function calculateLoopStatus(primary: AutonomousLoopTarget): AutonomousLoopStatus {
  if (!primary.safeToContinue) return "blocked";
  if (primary.requiresGabiApproval) return "needs_approval";
  if (primary.risk === "critical") return "needs_approval";
  if (primary.risk === "high") return "needs_attention";
  if (primary.area === "autonomous_monitoring") return "monitoring";

  return "completed";
}

async function shouldSaveLoopSuggestion(target: AutonomousLoopTarget) {
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

export async function runAutonomousLoop(
  task = "Run controlled autonomous loop for Awenia"
) {
  const startedAt = new Date().toISOString();

  if (autonomousLoopRunning) {
    return {
      status: "blocked",

      autonomousLoop: {
        task,
        reason: "Autonomous loop is already running",
        recursionBlocked: true,
        safeToContinue: false,
        requiresGabiApproval: false,
        controlledByGabi: true,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      timestamp: new Date().toISOString(),
    };
  }

  autonomousLoopRunning = true;

  try {
    const backgroundWorkerResult = await safeRead(
      "backgroundWorker",
      () => runBackgroundWorker(task),
      {
        status: "failed",
        error: "Background worker failed",
      }
    );

    const selfSustainingResult = await safeRead(
      "selfSustaining",
      () => runSelfSustainingSystem(task),
      {
        status: "failed",
        selfSustainingSystem: {
          safeToContinue: false,
          requiresGabiApproval: true,
        },
      }
    );

    const omniscientResult = await safeRead(
      "omniscientCognition",
      () => runOmniscientCognition(task),
      {
        status: "failed",
        omniscientCognition: {
          safeToContinue: false,
          requiresGabiApproval: true,
        },
      }
    );

    const sourceFailures = [
      backgroundWorkerResult,
      selfSustainingResult,
      omniscientResult,
    ].filter((item) => item.status === "failed").length;

    const sourceErrors = [
      backgroundWorkerResult.error,
      selfSustainingResult.error,
      omniscientResult.error,
    ].filter(Boolean);

    const targets = buildLoopTargets({
      backgroundWorker: backgroundWorkerResult.data,
      selfSustaining: selfSustainingResult.data,
      omniscient: omniscientResult.data,
      sourceFailures,
    });

    const primaryTarget = targets[0];

    const loopPlan = buildLoopPlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    let reflectionSaved = false;
    let suggestionSaved = false;

    await createAutonomousReflection(
      `Autonomous loop selected target: ${primaryTarget.area}`,
      primaryTarget.reason,
      primaryTarget.action
    );

    reflectionSaved = true;

    if (await shouldSaveLoopSuggestion(primaryTarget)) {
      await createEvolutionSuggestion(
        `Autonomous loop: ${primaryTarget.area}`,
        `${primaryTarget.reason}. Recommended action: ${primaryTarget.action}`,
        primaryTarget.priority === "critical"
          ? 9
          : primaryTarget.priority === "high"
            ? 8
            : 6
      );

      suggestionSaved = true;
    }

    const status = calculateLoopStatus(primaryTarget);

    return {
      status,

      autonomousLoop: {
        task,

        meaning:
          "Autonomous loop runs controlled monitoring cycles, not uncontrolled infinite execution.",

        primaryTarget,

        targets,

        loopPlan,

        workflowPlan,

        reflectionSaved,

        suggestionSaved,

        backgroundWorker: backgroundWorkerResult.data,

        selfSustaining: selfSustainingResult.data,

        omniscientCognition: omniscientResult.data,

        sourceStatus: {
          backgroundWorker: backgroundWorkerResult.status,
          selfSustaining: selfSustainingResult.status,
          omniscientCognition: omniscientResult.status,
        },

        sourceErrors,

        requiresGabiApproval:
          primaryTarget.requiresGabiApproval ||
          primaryTarget.risk === "high" ||
          primaryTarget.risk === "critical",

        safeToContinue:
          primaryTarget.safeToContinue &&
          primaryTarget.risk !== "critical",

        blocked:
          status === "blocked" ||
          primaryTarget.safeToContinue === false,

        recursionBlocked: false,

        controlledByGabi: true,

        rules: {
          noInfiniteUncontrolledLoop: true,
          noHighRiskActionWithoutApproval: true,
          noCodeModificationWithoutApproval: true,
          noFakeSystemStatus: true,
          canExecuteOnlyLowRiskBackgroundActions: true,
          mustSaveReflectionAfterCycle: true,
        },

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence:
          omniscientResult.data.omniscientCognition?.confidence ||
          selfSustainingResult.data.selfSustainingSystem?.confidence ||
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

      autonomousLoop: {
        task,

        meaning:
          "Autonomous loop runs controlled monitoring cycles, not uncontrolled infinite execution.",

        primaryTarget: {
          area: "autonomous_loop",
          priority: "critical",
          score: 100,
          reason: error?.message || "Autonomous loop failed",
          action: "Repair autonomous-loop.ts or connected systems",
          risk: "critical",
          requiresGabiApproval: true,
          safeToContinue: false,
        },

        targets: [],

        loopPlan: [],

        workflowPlan: null,

        reflectionSaved: false,

        suggestionSaved: false,

        sourceStatus: {},

        sourceErrors: [
          error?.message || "Unknown autonomous loop error",
        ],

        requiresGabiApproval: true,

        safeToContinue: false,

        blocked: true,

        recursionBlocked: false,

        controlledByGabi: true,

        rules: {
          noInfiniteUncontrolledLoop: true,
          noHighRiskActionWithoutApproval: true,
          noCodeModificationWithoutApproval: true,
          noFakeSystemStatus: true,
          canExecuteOnlyLowRiskBackgroundActions: true,
          mustSaveReflectionAfterCycle: true,
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

      error: error?.message || "Unknown autonomous loop error",

      timestamp: new Date().toISOString(),
    };
  } finally {
    autonomousLoopRunning = false;
  }
}

export async function runAutonomousLoopCycle(task?: string) {
  return runAutonomousLoop(task);
}

export async function buildAutonomousLoopState(task?: string) {
  return runAutonomousLoop(task);
}