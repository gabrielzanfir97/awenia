import { optimizeCognition } from "./cognitive-optimization";
import { runMetaCognition } from "./meta-cognition";

export async function expandIntelligence() {
  const optimization =
    await optimizeCognition();

  const meta =
    await runMetaCognition();

  const awarenessLevel =
    meta.metaCognition.selfAnalysis.awarenessLevel;

  const reasoningQuality =
    meta.metaCognition.selfAnalysis.reasoningQuality;

  const optimizationScore =
    optimization.cognitiveOptimization
      ?.optimizationScore || 0;

  return {
    intelligenceExpansion: {
      active: true,

      expansion: {
        cognition:
          optimizationScore >= 80
            ? "advanced"
            : optimizationScore >= 60
            ? "developing"
            : "basic",

        reasoning: reasoningQuality,

        awareness:
          awarenessLevel,

        autonomy:
          optimizationScore >= 70
            ? "high"
            : optimizationScore >= 50
            ? "medium"
            : "low",
      },

      expansionAnalysis: {
        awarenessLevel,
        reasoningQuality,
        optimizationScore,
        expansionReadiness:
          optimizationScore >= 70,
      },

      optimization,

      meta,

      nextEvolutionTargets: [
        "Improve distributed reasoning",
        "Expand long-term memory",
        "Optimize autonomous workflows",
        "Increase adaptive intelligence",
      ],
    },

    timestamp: new Date().toISOString(),
  };
}