import { runAutonomousRuntime } from "./autonomous-runtime";
import { runSelfImprovementCycle } from "./self-improvement";
import { buildLongTermMemory } from "./long-term-memory";

import {
  createEvolutionReport,
} from "./memory-store";

export async function runEvolutionRuntime() {
  console.log("EVOLUTION_RUNTIME_RUNNING");
  const runtime = await runAutonomousRuntime();

  const selfImprovement =
    await runSelfImprovementCycle();

  const longTermMemory =
    await buildLongTermMemory();

  const primaryProblem =
    runtime.runtimeAnalysis?.primaryProblem ||
    "No primary problem detected";

  const recommendedAction =
    runtime.runtimeAnalysis?.recommendedAction ||
    "Continue monitoring";

  await createEvolutionReport(
    `Evolution runtime analysis: ${primaryProblem}`,
    `Decision: ${runtime.decision?.priority || "monitor"}`,
    recommendedAction,
    7
  );

  return {
    runtime,
    selfImprovement,
    longTermMemory,

    evolution: {
      autonomous: true,
      continuous: true,
      learning: true,
      protected: true,
      reportsCreated: true,
    },

    evolutionAnalysis: {
      primaryProblem,
      recommendedAction,
      decision:
        runtime.decision?.priority || "monitor",
      awarenessScore:
        runtime.runtimeAnalysis?.awarenessScore,
    },

    status: "evolving",

    timestamp: new Date().toISOString(),
  };
}