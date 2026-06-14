import { runAutonomousRuntime } from "./autonomous-runtime";
import { runSelfImprovementCycle } from "./self-improvement";
import { buildLongTermMemory } from "./long-term-memory";

import {
  createEvolutionReport,
  getEvolutionReports,
} from "./memory-store";

function getRuntimeDecision(runtime: any) {
  return runtime?.decision?.priority || "monitor";
}

function getAwarenessScore(runtime: any) {
  return runtime?.runtimeAnalysis?.awarenessScore || 0;
}

function getPrimaryProblem(runtime: any) {
  return (
    runtime?.runtimeAnalysis?.primaryProblem ||
    runtime?.error ||
    "No primary problem detected"
  );
}

function getRecommendedAction(runtime: any) {
  return (
    runtime?.runtimeAnalysis?.recommendedAction ||
    "Continue monitoring"
  );
}

function calculateEvolutionStatus(input: {
  runtimeStatus?: string;
  selfImprovementStatus?: string;
  awarenessScore: number;
  decision: string;
  workflowSuccess?: boolean;
}) {
  if (
    input.runtimeStatus === "failed" ||
    input.selfImprovementStatus === "failed" ||
    input.workflowSuccess === false
  ) {
    return "failed";
  }

  if (input.awarenessScore >= 70 && input.decision !== "monitor") {
    return "evolving";
  }

  if (input.decision !== "monitor") {
    return "improving";
  }

  return "stable";
}

async function shouldCreateEvolutionRuntimeReport(
  primaryProblem: string,
  decision: string
) {
  const recentReports = await getEvolutionReports(10);

  const signature = `${primaryProblem} ${decision}`
    .toLowerCase()
    .trim();

  const duplicate = recentReports.some((report: any) => {
    const existing = `${report.report || ""} ${report.detected_patterns || ""
      }`
      .toLowerCase()
      .trim();

    return existing.includes(signature.slice(0, 80));
  });

  return !duplicate;
}

export async function runEvolutionRuntime() {
  console.log("EVOLUTION_RUNTIME_RUNNING");

  const startedAt = new Date().toISOString();

  try {
    const runtime = await runAutonomousRuntime();

    const selfImprovement = await runSelfImprovementCycle();

    const longTermMemory = await buildLongTermMemory();

    const primaryProblem = getPrimaryProblem(runtime);
    const recommendedAction = getRecommendedAction(runtime);
    const decision = getRuntimeDecision(runtime);
    const awarenessScore = getAwarenessScore(runtime);

    const workflowSuccess =
      runtime?.workflow?.success !== undefined
        ? runtime.workflow.success
        : undefined;

    const status = calculateEvolutionStatus({
      runtimeStatus: runtime?.status,
      selfImprovementStatus: selfImprovement?.status,
      awarenessScore,
      decision,
      workflowSuccess,
    });

    const shouldReport =
      status !== "stable" &&
      (await shouldCreateEvolutionRuntimeReport(
        primaryProblem,
        decision
      ));

    if (shouldReport) {
      await createEvolutionReport(
        `Evolution runtime analysis: ${primaryProblem}`,
        `Decision: ${decision}. Runtime status: ${runtime?.status || "unknown"
        }. Self-improvement status: ${selfImprovement?.status || "unknown"
        }.`,
        recommendedAction,
        decision === "debug" || decision === "coding" ? 8 : 7
      );
    }

    return {
      runtime,

      selfImprovement,

      longTermMemory,

      evolution: {
        autonomous:
          runtime?.runtime?.autonomous === true &&
          runtime?.workflow?.success === true,

        continuous:
          runtime?.status !== "failed" &&
          selfImprovement?.status !== "failed",

        learning:
          runtime?.runtime?.learning === true ||
          (selfImprovement?.improvements?.weakSkills?.length ?? 0) > 0,

        protected:
          runtime?.status !== "failed",

        reportsCreated: shouldReport,
      },

      evolutionAnalysis: {
        primaryProblem,
        recommendedAction,
        decision,
        awarenessScore,

        runtimeStatus: runtime?.status || "unknown",

        selfImprovementStatus:
          selfImprovement?.status || "unknown",

        memoryHealth:
          longTermMemory?.memoryAnalysis?.memoryHealth ||
          "unknown",

        dominantMemoryArea:
          longTermMemory?.memoryAnalysis?.strongestArea ||
          "none",

        workflowConfidence:
          runtime?.workflow?.confidence ||
          selfImprovement?.workflow?.confidence ||
          0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),

        runtimeWorkflow:
          runtime?.workflow?.workflowId || null,

        selfImprovementWorkflow:
          selfImprovement?.workflow?.workflowId || null,
      },

      status,

      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
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
        primaryProblem:
          error?.message || "Evolution runtime failed",
        recommendedAction:
          "Review evolution runtime error before continuing.",
        decision: "debug",
        awarenessScore: 0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      status: "failed",

      error:
        error?.message || "Unknown evolution runtime error",

      timestamp: new Date().toISOString(),
    };
  }
}