import { runAutonomousRuntime } from "./autonomous-runtime";
import { runSelfImprovementCycle } from "./self-improvement";
import { buildLongTermMemory } from "./long-term-memory";

export async function runEvolutionRuntime() {
  const runtime = await runAutonomousRuntime();

  const selfImprovement =
    await runSelfImprovementCycle();

  const longTermMemory =
    await buildLongTermMemory();

  return {
    runtime,
    selfImprovement,
    longTermMemory,

    evolution: {
      autonomous: true,
      continuous: true,
      learning: true,
      protected: true,
    },

    status: "evolving",

    timestamp: new Date().toISOString(),
  };
}