import { runUnifiedIntelligenceCore } from "./unified-intelligence-core";
import { runGlobalCognition } from "./global-cognition";
import { runMetaCognition } from "./meta-cognition";
import { runReasoningNetwork } from "./reasoning-network";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type OmniscientCognitionStatus =
  | "stable"
  | "aware"
  | "needs_verification"
  | "needs_approval"
  | "blocked"
  | "failed";

export type OmniscientTarget = {
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
  fallback: any
): Promise<{
  name: string;
  data: T;
  status: "connected" | "failed";
  error: string | null;
}> {
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
      data: fallback as T,
      status: "failed",
      error: error?.message || `Failed to read ${name}`,
    };
  }
}

function getPriority(score: number): OmniscientTarget["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: OmniscientTarget[],
  target: Omit<OmniscientTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

function buildOmniscientTargets(input: {
  unified: any;
  global: any;
  meta: any;
  reasoning: any;
  sourceFailures: number;
}) {
  const targets: OmniscientTarget[] = [];

  const unifiedCore = input.unified.unifiedCore || {};
  const globalCognition = input.global.globalCognition || {};
  const metaCognition = input.meta.metaCognition || {};
  const reasoning = input.reasoning.reasoning || {};

  if (input.sourceFailures > 0) {
    addTarget(targets, {
      area: "source_verification",
      score: 100,
      reason: `${input.sourceFailures} omniscient cognition sources failed`,
      action: "Verify failed sources before answering or acting",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (input.unified.status === "blocked" || input.global.status === "blocked") {
    addTarget(targets, {
      area: "blocked_cognition",
      score: 100,
      reason: "One higher cognition layer is blocked",
      action: "Stop escalation and wait for Gabi approval",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (
    unifiedCore.requiresGabiApproval === true ||
    globalCognition.requiresGabiApproval === true
  ) {
    addTarget(targets, {
      area: "gabi_approval",
      score: 95,
      reason: "Current cognition result requires Gabi approval",
      action: "Prepare approval request instead of executing automatically",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (metaCognition.selfCheck?.canTrustOwnState === false) {
    addTarget(targets, {
      area: "truth_verification",
      score: 90,
      reason: "Meta-cognition cannot fully trust current system state",
      action: "Do not invent system facts; verify before answering",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (reasoning.truthCheck?.mustVerify === true) {
    addTarget(targets, {
      area: "reasoning_verification",
      score: 85,
      reason:
        reasoning.truthCheck.reason ||
        "Reasoning network requires verification",
      action: "Verify uncertain reasoning before confident answer or action",
      risk: "high",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  const unifiedTarget = unifiedCore.primaryTarget;

  if (unifiedTarget && unifiedTarget.area !== "unified_monitoring") {
    addTarget(targets, {
      area: unifiedTarget.area,
      score: unifiedTarget.score || 70,
      reason: unifiedTarget.reason,
      action: unifiedTarget.action,
      risk: unifiedTarget.risk,
      requiresGabiApproval:
        unifiedTarget.requiresGabiApproval === true,
      safeToContinue: unifiedTarget.safeToContinue === true,
    });
  }

  const globalTarget = globalCognition.primaryTarget;

  if (globalTarget && globalTarget.area !== "global_monitoring") {
    addTarget(targets, {
      area: globalTarget.area,
      score: globalTarget.score || 65,
      reason: globalTarget.reason,
      action: globalTarget.action,
      risk: globalTarget.risk,
      requiresGabiApproval:
        globalTarget.requiresGabiApproval === true,
      safeToContinue: globalTarget.safeToContinue === true,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "verified_awareness",
      score: 20,
      reason: "No urgent omniscient cognition issue detected",
      action: "Continue verified awareness and avoid claiming unverified facts",
      risk: "low",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function buildOmniscientPlan(targets: OmniscientTarget[]) {
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

function calculateStatus(primary: OmniscientTarget): OmniscientCognitionStatus {
  if (!primary.safeToContinue) return "blocked";
  if (primary.requiresGabiApproval) return "needs_approval";
  if (primary.risk === "critical") return "needs_approval";
  if (primary.risk === "high") return "needs_verification";
  if (primary.area === "verified_awareness") return "stable";

  return "aware";
}

async function shouldSaveOmniscientSuggestion(target: OmniscientTarget) {
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

export async function runOmniscientCognition(
  task = "Analyze verified whole-system cognition for Awenia"
) {
  const startedAt = new Date().toISOString();

  try {
    const unifiedResult = await safeRead(
      "unifiedCore",
      () => runUnifiedIntelligenceCore(task),
      {
        status: "failed",
        unifiedCore: {
          safeToContinue: false,
          requiresGabiApproval: true,
          primaryTarget: {
            area: "unified_core_unavailable",
            priority: "critical",
            score: 100,
            reason: "Unified core unavailable",
            action: "Repair unified core",
            risk: "critical",
            requiresGabiApproval: true,
            safeToContinue: false,
          },
        },
      }
    );

    const globalResult = await safeRead(
      "globalCognition",
      () => runGlobalCognition(task),
      {
        status: "failed",
        globalCognition: {
          safeToContinue: false,
          requiresGabiApproval: true,
          primaryTarget: {
            area: "global_cognition_unavailable",
            priority: "critical",
            score: 100,
            reason: "Global cognition unavailable",
            action: "Repair global cognition",
            risk: "critical",
            requiresGabiApproval: true,
            safeToContinue: false,
          },
        },
      }
    );

    const metaResult = await safeRead(
      "metaCognition",
      () => runMetaCognition({ omniscientTask: task }),
      {
        status: "failed",
        metaCognition: {
          selfCheck: {
            identity: "meta_cognition",
            canTrustOwnState: false,
            confidence: 0,
            sourceFailures: 1,
            unknownCount: 0,
          },
          recommendedAction: "Repair meta cognition",
        },
      }
    );

    const reasoningResult = await safeRead(
      "reasoning",
      () => runReasoningNetwork({ omniscientTask: task }),
      {
        status: "failed",
        reasoning: {
          finalConclusion: "Reasoning unavailable",
          recommendedAction: "Repair reasoning network",
          confidence: 0,
          findings: [],
          conflicts: [],
          truthCheck: {
            canAnswerConfidently: false,
            mustVerify: true,
            reason: "Reasoning failed",
          },
        },
        execution: undefined,
        timestamp: ""
      }
    );

    const sourceFailures = [
      unifiedResult,
      globalResult,
      metaResult,
      reasoningResult,
    ].filter((item) => item.status === "failed").length;

    const sourceErrors = [
      unifiedResult.error,
      globalResult.error,
      metaResult.error,
      reasoningResult.error,
    ].filter(Boolean);

    const targets = buildOmniscientTargets({
      unified: unifiedResult.data,
      global: globalResult.data,
      meta: metaResult.data,
      reasoning: reasoningResult.data,
      sourceFailures,
    });

    const primaryTarget = targets[0];

    const omniscientPlan = buildOmniscientPlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    let suggestionSaved = false;

    if (await shouldSaveOmniscientSuggestion(primaryTarget)) {
      await createEvolutionSuggestion(
        `Omniscient cognition: ${primaryTarget.area}`,
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

      omniscientCognition: {
        task,

        meaning:
          "Omniscient cognition means verified whole-system awareness, not knowing everything without evidence.",

        primaryTarget,

        targets,

        omniscientPlan,

        workflowPlan,

        suggestionSaved,

        unifiedCore: unifiedResult.data,

        globalCognition: globalResult.data,

        metaCognition: metaResult.data,

        reasoning: reasoningResult.data,

        sourceStatus: {
          unifiedCore: unifiedResult.status,
          globalCognition: globalResult.status,
          metaCognition: metaResult.status,
          reasoning: reasoningResult.status,
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

        controlledByGabi: true,

        truthPolicy: {
          neverClaimUnverifiedSystemFacts: true,
          verifyBeforeAnsweringSystemStatus: true,
          admitUnknownWhenNotVerified: true,
          noBuildStatusWithoutBuild: true,
          noFileStatusWithoutReadingFile: true,
          noInternetStatusWithoutCheck: true,
        },

        capabilities: {
          canUseWholeSystemContext: sourceFailures === 0,
          canTrustOwnState:
            metaResult.data.metaCognition?.selfCheck
              ?.canTrustOwnState === true,
          canAnswerConfidently:
            reasoningResult.data.reasoning?.truthCheck
              ?.canAnswerConfidently === true,
          canActAutonomously:
            primaryTarget.safeToContinue === true &&
            primaryTarget.requiresGabiApproval === false,
        },

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence:
          unifiedResult.data.unifiedCore?.confidence ||
          globalResult.data.globalCognition?.confidence ||
          metaResult.data.metaCognition?.selfCheck?.confidence ||
          reasoningResult.data.reasoning?.confidence ||
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

      omniscientCognition: {
        task,

        meaning:
          "Omniscient cognition means verified whole-system awareness, not knowing everything without evidence.",

        primaryTarget: {
          area: "omniscient_cognition",
          priority: "critical",
          score: 100,
          reason:
            error?.message || "Omniscient cognition failed",
          action:
            "Repair omniscient-cognition.ts or connected systems",
          risk: "critical",
          requiresGabiApproval: true,
          safeToContinue: false,
        },

        targets: [],

        omniscientPlan: [],

        workflowPlan: null,

        suggestionSaved: false,

        sourceStatus: {},

        sourceErrors: [
          error?.message || "Unknown omniscient cognition error",
        ],

        requiresGabiApproval: true,

        safeToContinue: false,

        blocked: true,

        controlledByGabi: true,

        truthPolicy: {
          neverClaimUnverifiedSystemFacts: true,
          verifyBeforeAnsweringSystemStatus: true,
          admitUnknownWhenNotVerified: true,
        },

        capabilities: {
          canUseWholeSystemContext: false,
          canTrustOwnState: false,
          canAnswerConfidently: false,
          canActAutonomously: false,
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
        error?.message || "Unknown omniscient cognition error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildOmniscientCognition(task?: string) {
  return runOmniscientCognition(task);
}

export async function analyzeOmniscientCognition(task?: string) {
  return runOmniscientCognition(task);
}

// End of omniscient-cognition.ts
