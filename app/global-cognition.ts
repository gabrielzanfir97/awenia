import { runAIEcosystem } from "./ai-ecosystem";
import { runDistributedIntelligence } from "./distributed-intelligence";
import { buildConsciousnessState } from "./consciousness";

export async function runGlobalCognition() {
  const ecosystem =
    await runAIEcosystem();

  const distributed =
    await runDistributedIntelligence();

  const consciousness =
    await buildConsciousnessState();

  const state =
    consciousness.consciousness.state;

  const awarenessScore =
    consciousness.consciousness.selfUnderstanding
      ?.awarenessScore || 0;

  const primaryProblem =
    consciousness.consciousness.selfUnderstanding
      ?.primaryProblem || "none_detected";

  const recommendedAction =
    consciousness.consciousness.selfUnderstanding
      ?.recommendedAction || "Continue monitoring";

  return {
    globalCognition: {
      active: true,

      cognition: {
        unified: awarenessScore > 50,
        autonomous: state !== "needs_attention",
        adaptive: awarenessScore > 40,
        persistent: true,
      },

      health: {
        state,
        awarenessScore,
        primaryProblem,
        recommendedAction,
      },

      systems: {
        ecosystem,
        distributed,
        consciousness,
      },

      activeProcesses: [
        "global reasoning",
        "distributed cognition",
        "continuous evolution",
        "adaptive intelligence",
        "autonomous coordination",
        "persistent awareness",
      ],
    },

    timestamp: new Date().toISOString(),
  };
}