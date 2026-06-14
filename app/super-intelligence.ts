import { runAIEcosystem } from "./ai-ecosystem";
import { runMetaCognition } from "./meta-cognition";
import { runReasoningNetwork } from "./reasoning-network";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

type SuperIntelligenceStatus =
  | "stable"
  | "active"
  | "needs_attention"
  | "limited"
  | "failed";

function calculateSuperStatus(input: {
  ecosystemStatus?: string;
  metaStatus?: string;
  reasoningStatus?: string;
  confidence: number;
  sourceFailures: number;
  criticalTargets: number;
}): SuperIntelligenceStatus {
  if (
    input.ecosystemStatus === "failed" ||
    input.metaStatus === "failed" ||
    input.reasoningStatus === "failed"
  ) {
    return "failed";
  }

  if (input.sourceFailures > 0 || input.criticalTargets > 0) {
    return "needs_attention";
  }

  if (
    input.metaStatus !== "clear" ||
    input.reasoningStatus !== "clear"
  ) {
    return "limited";
  }

  if (input.confidence >= 80) {
    return "stable";
  }

  return "active";
}

function calculateConfidence(input: {
  ecosystemConfidence?: number;
  metaConfidence?: number;
  reasoningConfidence?: number;
  sourceFailures: number;
}) {
  const values = [
    input.ecosystemConfidence || 0,
    input.metaConfidence || 0,
    input.reasoningConfidence || 0,
  ];

  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return Math.max(
    0,
    Math.min(100, Math.round(average - input.sourceFailures * 10))
  );
}

function buildCapabilityMap(input: {
  ecosystem: any;
  meta: any;
  reasoning: any;
}) {
  return {
    canReason:
      input.reasoning.status === "clear" ||
      input.reasoning.status === "conflicted" ||
      input.reasoning.status === "needs_verification",

    canSelfCheck:
      input.meta.status !== "failed",

    canCoordinateAgents:
      getAgentState().length > 0,

    canOptimize:
      input.ecosystem.status !== "failed",

    canAnswerConfidently:
      input.reasoning.reasoning?.truthCheck?.canAnswerConfidently === true &&
      input.meta.metaCognition?.selfCheck?.canTrustOwnState === true,

    canActAutonomously:
      input.ecosystem.status !== "failed" &&
      input.ecosystem.ecosystem?.confidence >= 60,
  };
}

function buildLimits(input: {
  sourceFailures: number;
  meta: any;
  reasoning: any;
}) {
  const limits: string[] = [];

  if (input.sourceFailures > 0) {
    limits.push("Some real system sources failed and must be verified.");
  }

  if (input.meta.status !== "clear") {
    limits.push("Meta-cognition is not fully clear.");
  }

  if (input.reasoning.status !== "clear") {
    limits.push("Reasoning network needs verification or has conflicts.");
  }

  if (limits.length === 0) {
    limits.push("No critical limitation detected.");
  }

  return limits;
}

export async function runSuperIntelligenceFramework(
  task = "Analyze Awenia super-intelligence state"
) {
  const startedAt = new Date().toISOString();

  try {
    const ecosystem = await runAIEcosystem(task);

    const meta = await runMetaCognition({
      superIntelligenceTask: task,
      ecosystemStatus: ecosystem.status,
    });

    const reasoning = await runReasoningNetwork({
      superIntelligenceTask: task,
      ecosystemStatus: ecosystem.status,
      metaStatus: meta.status,
    });

    const sourceFailures =
      ecosystem.ecosystem?.coordination?.sourceFailures ||
      meta.metaCognition?.selfCheck?.sourceFailures ||
      0;

    const criticalTargets =
      ecosystem.ecosystem?.coordination?.criticalTargets || 0;

    const confidence = calculateConfidence({
      ecosystemConfidence: ecosystem.ecosystem?.confidence,
      metaConfidence: meta.metaCognition?.selfCheck?.confidence,
      reasoningConfidence: reasoning.reasoning?.confidence,
      sourceFailures,
    });

    const status = calculateSuperStatus({
      ecosystemStatus: ecosystem.status,
      metaStatus: meta.status,
      reasoningStatus: reasoning.status,
      confidence,
      sourceFailures,
      criticalTargets,
    });

    const capabilities = buildCapabilityMap({
      ecosystem,
      meta,
      reasoning,
    });

    const limits = buildLimits({
      sourceFailures,
      meta,
      reasoning,
    });

    const recommendedAction =
      reasoning.reasoning?.recommendedAction ||
      meta.metaCognition?.recommendedAction ||
      ecosystem.ecosystem?.coordination?.recommendedAction ||
      "Continue monitoring";

    const workflowPlan = coordinateAgents(
      status === "needs_attention" ? "debug" : "planning",
      `${recommendedAction}. Super-intelligence status: ${status}`
    );

    return {
      status,

      superIntelligence: {
        active: status !== "failed",

        stable: status === "stable",

        limited:
          status === "limited" ||
          status === "needs_attention" ||
          status === "failed",

        confidence,

        task,

        ecosystem,

        metaCognition: meta,

        reasoning,

        capabilities,

        limits,

        truthPolicy:
          meta.metaCognition?.truthPolicy || {
            safeAnswerRule:
              "Do not invent system state. Verify before answering.",
          },

        coordination: {
          recommendedAction,
          sourceFailures,
          criticalTargets,
          workflowPlan,
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

      superIntelligence: {
        active: false,
        stable: false,
        limited: true,
        confidence: 0,
        task,

        capabilities: {
          canReason: false,
          canSelfCheck: false,
          canCoordinateAgents: getAgentState().length > 0,
          canOptimize: false,
          canAnswerConfidently: false,
          canActAutonomously: false,
        },

        limits: [
          error?.message || "Super-intelligence framework failed.",
        ],

        truthPolicy: {
          safeAnswerRule:
            "Do not invent system state. Repair super-intelligence first.",
        },

        coordination: {
          recommendedAction:
            "Repair super-intelligence.ts or connected systems",
          sourceFailures: 1,
          criticalTargets: 1,
          workflowPlan: null,
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

      error:
        error?.message || "Unknown super-intelligence error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildSuperIntelligence(task?: string) {
  return runSuperIntelligenceFramework(task);
}

export async function analyzeSuperIntelligence(task?: string) {
  return runSuperIntelligenceFramework(task);
}

export async function runSuperIntelligence(task?: string) {
  return runSuperIntelligenceFramework(task);
}