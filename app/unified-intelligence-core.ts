import { runGlobalCognition } from "./global-cognition";
import { runAIEcosystem } from "./ai-ecosystem";
import { buildConsciousnessState } from "./consciousness";

export async function runUnifiedIntelligenceCore() {
  const globalCognition =
    await runGlobalCognition();

  const ecosystem =
    await runAIEcosystem();

  const consciousness =
    await buildConsciousnessState();

  const awarenessScore =
    consciousness.consciousness.selfUnderstanding
      ?.awarenessScore || 0;

  const state =
    consciousness.consciousness.state;

  const ecosystemHealth =
    ecosystem.aiEcosystem.ecosystemAnalysis
      ?.health || "unknown";

  return {
    unifiedIntelligenceCore: {
      active: true,

      intelligence: {
        unified: awarenessScore >= 50,
        autonomous: state !== "needs_attention",
        adaptive: awarenessScore >= 40,
        persistent: true,
        protected: true,
      },

      coreAnalysis: {
        awarenessScore,
        consciousnessState: state,
        ecosystemHealth,

        intelligenceLevel:
          awarenessScore >= 80
            ? "advanced"
            : awarenessScore >= 60
            ? "developing"
            : "basic",
      },

      systems: {
        globalCognition,
        ecosystem,
        consciousness,
      },

      coreProcesses: [
        "global reasoning",
        "autonomous evolution",
        "distributed cognition",
        "adaptive optimization",
        "persistent awareness",
        "continuous self-improvement",
      ],
    },

    timestamp: new Date().toISOString(),
  };
}