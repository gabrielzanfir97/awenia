import { buildConsciousnessState } from "./consciousness";
import { runSelfSustainingSystem } from "./self-sustaining-system";
import { runMetaCognition } from "./meta-cognition";
import { runReasoningNetwork } from "./reasoning-network";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type UnifiedCoreStatus =
  | "stable"
  | "active"
  | "needs_approval"
  | "needs_attention"
  | "blocked"
  | "failed";

export type UnifiedCoreTarget = {
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
    const data = await reader();
    const nestedStatus = (data as { status?: unknown } | null)?.status;
    return {
      name,
      data,
      status: nestedStatus === "failed" || nestedStatus === "blocked" ? "failed" : "connected",
      error: nestedStatus === "failed" || nestedStatus === "blocked"
        ? `${name} returned status ${nestedStatus}` : null,
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

function getPriority(score: number): UnifiedCoreTarget["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: UnifiedCoreTarget[],
  target: Omit<UnifiedCoreTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

function buildUnifiedTargets(input: {
  consciousness: any;
  selfSustaining: any;
  meta: any;
  reasoning: any;
  sourceFailures: number;
}) {
  const targets: UnifiedCoreTarget[] = [];

  const consciousnessData = input.consciousness.consciousness || {};
  const selfSustainingData =
    input.selfSustaining.selfSustainingSystem || {};
  const metaData = input.meta.metaCognition || {};
  const reasoningData = input.reasoning.reasoning || {};

  if (input.sourceFailures > 0) {
    addTarget(targets, {
      area: "core_source_repair",
      score: 100,
      reason: `${input.sourceFailures} unified core sources failed`,
      action: "Repair failed core sources before continuing",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (input.selfSustaining.status === "blocked") {
    addTarget(targets, {
      area: "blocked_autonomy",
      score: 100,
      reason: "Self-sustaining system is blocked",
      action: "Stop autonomous escalation and wait for Gabi approval",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (
    selfSustainingData.requiresGabiApproval === true ||
    input.selfSustaining.status === "needs_approval"
  ) {
    addTarget(targets, {
      area: "gabi_approval",
      score: 95,
      reason: "Unified core detected an action requiring Gabi approval",
      action: "Prepare approval request instead of executing automatically",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (consciousnessData.verified === false) {
    addTarget(targets, {
      area: "consciousness_verification",
      score: 85,
      reason: "Consciousness state is not fully verified",
      action: "Verify awareness, memory, goals and runtime before confident action",
      risk: "high",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  if (metaData.selfCheck?.canTrustOwnState === false) {
    addTarget(targets, {
      area: "truth_control",
      score: 90,
      reason: "Meta-cognition cannot fully trust current system state",
      action: "Do not invent system facts; verify before answering",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (reasoningData.truthCheck?.mustVerify === true) {
    addTarget(targets, {
      area: "reasoning_verification",
      score: 85,
      reason:
        reasoningData.truthCheck.reason ||
        "Reasoning requires verification",
      action: "Verify uncertain reasoning before action",
      risk: "high",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  const sustainTarget = selfSustainingData.primaryTarget;

  if (
    sustainTarget &&
    sustainTarget.area !== "self_sustaining_monitoring"
  ) {
    addTarget(targets, {
      area: sustainTarget.area,
      score: sustainTarget.score || 70,
      reason: sustainTarget.reason,
      action: sustainTarget.action,
      risk: sustainTarget.risk,
      requiresGabiApproval:
        sustainTarget.requiresGabiApproval === true,
      safeToContinue: sustainTarget.safeToContinue === true,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "unified_monitoring",
      score: 20,
      reason: "No urgent unified core issue detected",
      action: "Continue verified monitoring without unnecessary changes",
      risk: "low",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function buildUnifiedPlan(targets: UnifiedCoreTarget[]) {
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

function calculateStatus(primary: UnifiedCoreTarget): UnifiedCoreStatus {
  if (!primary.safeToContinue) return "blocked";
  if (primary.requiresGabiApproval) return "needs_approval";
  if (primary.risk === "critical") return "needs_approval";
  if (primary.risk === "high") return "needs_attention";
  if (primary.area === "unified_monitoring") return "stable";

  return "active";
}

async function shouldSaveUnifiedSuggestion(target: UnifiedCoreTarget) {
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

export async function runUnifiedIntelligenceCore(
  task = "Analyze unified intelligence core for Awenia"
) {
  const startedAt = new Date().toISOString();

  try {
    const consciousnessResult = await safeRead(
      "consciousness",
      () => buildConsciousnessState(),
      {
        consciousness: {
          state: "needs_attention",
          verified: false,
          confidence: 0,
          selfUnderstanding: {
            primaryProblem: "Consciousness unavailable",
            recommendedAction: "Repair consciousness",
            awarenessScore: undefined,
            confidence: 0,
            sourceFailures: 0
          },
          continuity: {
            protected: false,
            evolving: false,
            autonomous: false,
          },
          identity: "",
          sourceStatus: undefined,
          sourceErrors: [],
          awareness: undefined,
          memory: undefined,
          goals: undefined,
          runtime: undefined,
          execution: undefined
        },
      } as any
    );

    const selfSustainingResult = await safeRead(
      "selfSustaining",
      () => runSelfSustainingSystem(task),
      {
        status: "failed",
        selfSustainingSystem: {
          safeToContinue: false,
          requiresGabiApproval: true,
          primaryTarget: {
            area: "self_sustaining_unavailable",
            priority: "critical",
            score: 100,
            reason: "Self-sustaining unavailable",
            action: "Repair self-sustaining system",
            risk: "critical",
            requiresGabiApproval: true,
            safeToContinue: false,
          },
        },
      } as any
    );

    const metaResult = await safeRead(
      "metaCognition",
      () => runMetaCognition({ unifiedCoreTask: task }),
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
          verifiedKnowledge: [],
          estimatedKnowledge: [],
          unknowns: [],
          truthPolicy: {
            safeAnswerRule: "strict",
            mustNotInvent: [],
            mustVerifyBeforeAnswering: [],
          },
          contextReceived: undefined,
          recommendedAction: "Repair meta cognition",
        },
      } as any
    );

    const reasoningResult = await safeRead(
      "reasoning",
      () => runReasoningNetwork({ unifiedCoreTask: task }),
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
        execution: { startedAt: "", completedAt: "" },
        timestamp: "",
        error: undefined
      } as any
    );

    const sourceFailures = [
      consciousnessResult,
      selfSustainingResult,
      metaResult,
      reasoningResult,
    ].filter((item) => item.status === "failed").length;

    const sourceErrors = [
      consciousnessResult.error,
      selfSustainingResult.error,
      metaResult.error,
      reasoningResult.error,
    ].filter(Boolean);

    const targets = buildUnifiedTargets({
      consciousness: consciousnessResult.data,
      selfSustaining: selfSustainingResult.data,
      meta: metaResult.data,
      reasoning: reasoningResult.data,
      sourceFailures,
    });

    const primaryTarget = targets[0];

    const unifiedPlan = buildUnifiedPlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    let suggestionSaved = false;

    if (await shouldSaveUnifiedSuggestion(primaryTarget)) {
      await createEvolutionSuggestion(
        `Unified core: ${primaryTarget.area}`,
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

      unifiedCore: {
        task,

        identity: "Awenia",

        meaning:
          "Unified intelligence core means one controlled center that reads real state before action.",

        primaryTarget,

        targets,

        unifiedPlan,

        workflowPlan,

        suggestionSaved,

        consciousness: consciousnessResult.data,

        selfSustaining: selfSustainingResult.data,

        metaCognition: metaResult.data,

        reasoning: reasoningResult.data,

        sourceStatus: {
          consciousness: consciousnessResult.status,
          selfSustaining: selfSustainingResult.status,
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

        rules: {
          noFakeSystemStatus: true,
          noHighRiskActionWithoutApproval: true,
          noAutonomyWithoutMemoryAwarenessAndGoals: true,
          noExecutionWithoutWorkflowResult: true,
          mustReportUncertainty: true,
        },

        capabilities: {
          canThink:
            metaResult.status !== "failed" &&
            reasoningResult.status !== "failed",

          canTrustOwnState:
            metaResult.data.metaCognition?.selfCheck
              ?.canTrustOwnState === true,

          canAnswerConfidently:
            reasoningResult.data.reasoning?.truthCheck
              ?.canAnswerConfidently === true,

          canActAutonomously:
            selfSustainingResult.data.selfSustainingSystem
              ?.safeToContinue === true &&
            primaryTarget.requiresGabiApproval === false,
        },

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence:
          consciousnessResult.data.consciousness?.confidence ||
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

      unifiedCore: {
        task,

        identity: "Awenia",

        meaning:
          "Unified intelligence core means one controlled center that reads real state before action.",

        primaryTarget: {
          area: "unified_intelligence_core",
          priority: "critical",
          score: 100,
          reason:
            error?.message || "Unified intelligence core failed",
          action:
            "Repair unified-intelligence-core.ts or connected systems",
          risk: "critical",
          requiresGabiApproval: true,
          safeToContinue: false,
        },

        targets: [],

        unifiedPlan: [],

        workflowPlan: null,

        suggestionSaved: false,

        sourceStatus: {},

        sourceErrors: [
          error?.message || "Unknown unified intelligence core error",
        ],

        requiresGabiApproval: true,

        safeToContinue: false,

        blocked: true,

        controlledByGabi: true,

        rules: {
          noFakeSystemStatus: true,
          noHighRiskActionWithoutApproval: true,
          noAutonomyWithoutMemoryAwarenessAndGoals: true,
          noExecutionWithoutWorkflowResult: true,
          mustReportUncertainty: true,
        },

        capabilities: {
          canThink: false,
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
        error?.message || "Unknown unified intelligence core error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildUnifiedIntelligenceCore(task?: string) {
  return runUnifiedIntelligenceCore(task);
}

export async function analyzeUnifiedIntelligenceCore(task?: string) {
  return runUnifiedIntelligenceCore(task);
}

export async function runUnifiedCore(task?: string) {
  return runUnifiedIntelligenceCore(task);
}