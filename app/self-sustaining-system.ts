import { runUnifiedIntelligenceCore } from "./unified-intelligence-core";
import { runEvolutionRuntime } from "./evolution-runtime";
import { buildConsciousnessState } from "./consciousness";

export async function runSelfSustainingSystem() {
  const core =
    await runUnifiedIntelligenceCore();

  const evolution =
    await runEvolutionRuntime();

  const consciousness =
    await buildConsciousnessState();

  const awarenessScore =
    consciousness.consciousness.selfUnderstanding
      ?.awarenessScore || 0;

  const consciousnessState =
    consciousness.consciousness.state;

  const intelligenceLevel =
    core.unifiedIntelligenceCore.coreAnalysis
      ?.intelligenceLevel || "basic";

  return {
    selfSustainingSystem: {
      active: true,

      sustainability: {
        autonomous:
          awarenessScore >= 50,

        adaptive:
          awarenessScore >= 40,

        persistent: true,

        protected: true,

        evolving:
          evolution.status === "evolving",
      },

      sustainabilityAnalysis: {
        awarenessScore,
        consciousnessState,
        intelligenceLevel,

        health:
          awarenessScore >= 80
            ? "strong"
            : awarenessScore >= 60
            ? "developing"
            : "needs_attention",
      },

      systems: {
        core,
        evolution,
        consciousness,
      },

      maintenanceProcesses: [
        "continuous reasoning",
        "autonomous optimization",
        "persistent memory coordination",
        "adaptive evolution",
        "self-improvement cycles",
        "protected identity continuity",
      ],
    },

    timestamp: new Date().toISOString(),
  };
}