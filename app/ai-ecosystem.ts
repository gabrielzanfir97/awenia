import { buildCognitiveArchitecture } from "./cognitive-architecture";
import { optimizeCognition } from "./cognitive-optimization";
import { runDistributedIntelligence } from "./distributed-intelligence";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

type EcosystemStatus =
  | "stable"
  | "active"
  | "needs_attention"
  | "partial"
  | "failed";

function calculateEcosystemStatus(input: {
  architectureStatus?: string;
  optimizationStatus?: string;
  distributedStatus?: string;
  criticalTargets?: number;
  sourceFailures?: number;
}): EcosystemStatus {
  if (
    input.architectureStatus === "failed" ||
    input.optimizationStatus === "failed" ||
    input.distributedStatus === "failed"
  ) {
    return "failed";
  }

  if ((input.criticalTargets || 0) > 0 || (input.sourceFailures || 0) > 0) {
    return "needs_attention";
  }

  if (
    input.distributedStatus === "partial" ||
    input.architectureStatus === "degraded"
  ) {
    return "partial";
  }

  if (
    input.optimizationStatus === "stable" &&
    input.architectureStatus === "active"
  ) {
    return "stable";
  }

  return "active";
}

function calculateEcosystemConfidence(input: {
  architectureConfidence?: number;
  optimizationConfidence?: number;
  distributedConfidence?: number;
  sourceFailures?: number;
}) {
  const values = [
    input.architectureConfidence || 0,
    input.optimizationConfidence || 0,
    input.distributedConfidence || 0,
  ];

  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return Math.max(
    0,
    Math.min(100, Math.round(average - (input.sourceFailures || 0) * 10))
  );
}

export async function runAIEcosystem(
  task = "Analyze and coordinate Awenia AI ecosystem"
) {
  const startedAt = new Date().toISOString();

  try {
    const architecture = await buildCognitiveArchitecture();

    const optimization = await optimizeCognition();

    const distributed = await runDistributedIntelligence(task);

    const sourceFailures =
      architecture.architecture?.cognitiveState?.sourceFailures || 0;

    const criticalTargets =
      optimization.metrics?.criticalTargets || 0;

    const status = calculateEcosystemStatus({
      architectureStatus: architecture.architecture?.status,
      optimizationStatus: optimization.status,
      distributedStatus: distributed.status,
      criticalTargets,
      sourceFailures,
    });

    const confidence = calculateEcosystemConfidence({
      architectureConfidence: architecture.architecture?.confidence,
      optimizationConfidence: optimization.optimization?.confidence,
      distributedConfidence: distributed.confidence,
      sourceFailures,
    });

    const recommendedAction =
      optimization.optimization?.recommendedAction ||
      distributed.reasoning?.reasoning?.recommendedAction ||
      architecture.architecture?.layers?.decision?.action ||
      "Continue monitoring";

    return {
      status,

      ecosystem: {
        active: status !== "failed",

        stable: status === "stable",

        needsAttention:
          status === "needs_attention" || status === "partial",

        confidence,

        task,

        architecture,

        optimization,

        distributed,

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        coordination: {
          recommendedAction,
          sourceFailures,
          criticalTargets,

          primaryDecision:
            architecture.architecture?.layers?.decision || null,

          primaryOptimizationTarget:
            optimization.optimization?.primaryTarget || null,

          distributedSuccess: distributed.success,
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

      ecosystem: {
        active: false,
        stable: false,
        needsAttention: true,
        confidence: 0,
        task,

        coordination: {
          recommendedAction:
            "Repair ai-ecosystem.ts or connected intelligence systems",
          sourceFailures: 1,
          criticalTargets: 1,
          primaryDecision: null,
          primaryOptimizationTarget: null,
          distributedSuccess: false,
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

      error: error?.message || "Unknown AI ecosystem error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildAIEcosystem(task?: string) {
  return runAIEcosystem(task);
}

export async function coordinateAIEcosystem(task?: string) {
  return runAIEcosystem(task);
}

export async function analyzeAIEcosystem(task?: string) {
  return runAIEcosystem(task);
}