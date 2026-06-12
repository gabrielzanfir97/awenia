import { runDistributedIntelligence } from "./distributed-intelligence";
import { buildConsciousnessState } from "./consciousness";
import { runEvolutionRuntime } from "./evolution-runtime";

export async function runAIEcosystem() {
  const distributed =
    await runDistributedIntelligence();

  const consciousness =
    await buildConsciousnessState();

  const evolution =
    await runEvolutionRuntime();

  const consciousnessState =
    consciousness.consciousness.state;

  const awarenessScore =
    consciousness.consciousness.selfUnderstanding
      ?.awarenessScore || 0;

  const distributedActive =
    distributed.distributedIntelligence.active;

  const ecosystemHealth =
    awarenessScore >= 80
      ? "strong"
      : awarenessScore >= 60
      ? "developing"
      : "needs_attention";

  return {
    aiEcosystem: {
      active: true,

      systems: {
        distributed,
        consciousness,
        evolution,
      },

      ecosystemState: {
        autonomous: distributedActive,
        persistent: true,
        adaptive: awarenessScore > 40,
        protected: true,
        evolving: evolution.status === "evolving",
      },

      ecosystemAnalysis: {
        health: ecosystemHealth,
        consciousnessState,
        awarenessScore,
        distributedActive,
      },

      activeProcesses: [
        "distributed reasoning",
        "autonomous evolution",
        "long-term memory",
        "adaptive cognition",
        "goal coordination",
        "continuous optimization",
      ],
    },

    timestamp: new Date().toISOString(),
  };
}