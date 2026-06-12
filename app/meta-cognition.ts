import { runReasoningNetwork } from "./reasoning-network";

export async function runMetaCognition() {
  const reasoning =
    await runReasoningNetwork();

  const analysis =
    reasoning.reasoningNetwork.reasoningAnalysis;

  const awarenessScore =
    analysis.awarenessScore || 0;

  const reasoningQuality =
    awarenessScore >= 80
      ? "strong"
      : awarenessScore >= 60
      ? "developing"
      : "needs_attention";

  return {
    metaCognition: {
      active: true,

      selfAnalysis: {
        reasoningQuality,

        awarenessLevel:
          awarenessScore >= 80
            ? "high"
            : awarenessScore >= 60
            ? "medium"
            : "low",

        adaptiveState:
          analysis.stalledGoals > 0
            ? "recovering"
            : "learning",
      },

      observations: [
        `Awareness score: ${awarenessScore}`,
        `Active goals: ${analysis.goalCount}`,
        `Stalled goals: ${analysis.stalledGoals}`,
        analysis.recommendedReasoningAction,
      ],

      reasoning,
    },

    timestamp: new Date().toISOString(),
  };
}