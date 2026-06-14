import { runTranscendenceArchitecture } from "./transcendence";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type GlobalCognitionStatus =
  | "stable"
  | "thinking"
  | "needs_approval"
  | "needs_attention"
  | "blocked"
  | "failed";

export type GlobalCognitionTarget = {
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  score: number;
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresGabiApproval: boolean;
  safeToContinue: boolean;
};

let globalCognitionRunning = false;

function getPriority(score: number): GlobalCognitionTarget["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: GlobalCognitionTarget[],
  target: Omit<GlobalCognitionTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

function buildGlobalTargets(transcendence: any) {
  const targets: GlobalCognitionTarget[] = [];

  const primary = transcendence.transcendence?.primaryTarget;
  const blocked = transcendence.transcendence?.blocked === true;
  const requiresApproval =
    transcendence.transcendence?.requiresGabiApproval === true;
  const safeToContinue =
    transcendence.transcendence?.safeToContinue === true;

  if (transcendence.status === "failed") {
    addTarget(targets, {
      area: "global_recovery",
      score: 100,
      reason: "Transcendence architecture failed",
      action: "Repair global cognition chain before continuing",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (blocked) {
    addTarget(targets, {
      area: "blocked_global_cognition",
      score: 100,
      reason: "Higher cognition is blocked by safety rules",
      action: "Stop escalation and wait for Gabi approval",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (requiresApproval) {
    addTarget(targets, {
      area: "approval_required",
      score: 95,
      reason: "Current cognition path requires Gabi approval",
      action: "Prepare clear approval request before any high-risk action",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (primary) {
    addTarget(targets, {
      area: primary.area,
      score: primary.score || 70,
      reason: primary.reason,
      action: primary.action,
      risk: primary.risk,
      requiresGabiApproval:
        primary.requiresGabiApproval === true || requiresApproval,
      safeToContinue:
        primary.safeToContinue === true &&
        safeToContinue &&
        primary.risk !== "critical",
    });
  }

  if (!safeToContinue) {
    addTarget(targets, {
      area: "safety_verification",
      score: 85,
      reason: "Global cognition is not safe to continue automatically",
      action: "Keep result as analysis only, not execution",
      risk: "high",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "global_monitoring",
      score: 20,
      reason: "No urgent global cognition issue detected",
      action: "Continue verified monitoring without unnecessary changes",
      risk: "low",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function buildGlobalPlan(targets: GlobalCognitionTarget[]) {
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

function calculateStatus(primary: GlobalCognitionTarget): GlobalCognitionStatus {
  if (!primary.safeToContinue) return "blocked";
  if (primary.requiresGabiApproval) return "needs_approval";
  if (primary.risk === "critical") return "needs_approval";
  if (primary.risk === "high") return "needs_attention";
  if (primary.area === "global_monitoring") return "stable";

  return "thinking";
}

async function shouldSaveGlobalSuggestion(target: GlobalCognitionTarget) {
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

export async function runGlobalCognition(
  task = "Analyze global cognition state for Awenia"
) {
  const startedAt = new Date().toISOString();

  if (globalCognitionRunning) {
    return {
      status: "blocked",

      globalCognition: {
        task,
        reason: "Global cognition is already running",
        safeToContinue: false,
        requiresGabiApproval: false,
        recursionBlocked: true,
        controlledByGabi: true,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      timestamp: new Date().toISOString(),
    };
  }

  globalCognitionRunning = true;

  try {
    const transcendence = await runTranscendenceArchitecture(task);

    const targets = buildGlobalTargets(transcendence);

    const primaryTarget = targets[0];

    const globalPlan = buildGlobalPlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    let suggestionSaved = false;

    if (await shouldSaveGlobalSuggestion(primaryTarget)) {
      await createEvolutionSuggestion(
        `Global cognition: ${primaryTarget.area}`,
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

      globalCognition: {
        task,

        meaning:
          "Global cognition means verified whole-system coordination, not uncontrolled autonomy.",

        primaryTarget,

        targets,

        globalPlan,

        workflowPlan,

        suggestionSaved,

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
          noRecursiveCognitionLoops: true,
          noFakeSystemStatus: true,
          noHighRiskActionWithoutApproval: true,
          noEvolutionWithoutEvidence: true,
          memoryAndAwarenessBeforeAction: true,
        },

        transcendence,

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence:
          transcendence.transcendence?.confidence || 0,
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

      globalCognition: {
        task,

        meaning:
          "Global cognition means verified whole-system coordination, not uncontrolled autonomy.",

        primaryTarget: {
          area: "global_cognition",
          priority: "critical",
          score: 100,
          reason: error?.message || "Global cognition failed",
          action: "Repair global-cognition.ts or connected systems",
          risk: "critical",
          requiresGabiApproval: true,
          safeToContinue: false,
        },

        targets: [],

        globalPlan: [],

        workflowPlan: null,

        suggestionSaved: false,

        requiresGabiApproval: true,

        safeToContinue: false,

        blocked: true,

        recursionBlocked: false,

        controlledByGabi: true,

        rules: {
          noRecursiveCognitionLoops: true,
          noFakeSystemStatus: true,
          noHighRiskActionWithoutApproval: true,
          noEvolutionWithoutEvidence: true,
          memoryAndAwarenessBeforeAction: true,
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

      error: error?.message || "Unknown global cognition error",

      timestamp: new Date().toISOString(),
    };
  } finally {
    globalCognitionRunning = false;
  }
}

export async function buildGlobalCognition(task?: string) {
  return runGlobalCognition(task);
}

export async function analyzeGlobalCognition(task?: string) {
  return runGlobalCognition(task);
}