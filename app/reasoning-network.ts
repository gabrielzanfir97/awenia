import { Agents } from "./agents";
import { buildCognitiveArchitecture } from "./cognitive-architecture";

export async function runReasoningNetwork() {
  const cognitive =
    await buildCognitiveArchitecture();

  const architectureAnalysis =
    cognitive.cognitiveArchitecture.architectureAnalysis;

  const agents =
    Object.keys(Agents);

  const reasoningQuality =
    architectureAnalysis.architectureHealth === "strong"
      ? "strong"
      : architectureAnalysis.architectureHealth === "developing"
      ? "developing"
      : "needs_attention";

  const reasoningFocus =
    architectureAnalysis.mainCognitiveFocus;

  return {
    reasoningNetwork: {
      active: true,

      agents,

      reasoning: {
        distributed: true,
        adaptive: true,
        autonomous: true,
        quality: reasoningQuality,
        focus: reasoningFocus,
      },

      cognition: cognitive,

      reasoningAnalysis: {
        awarenessScore:
          architectureAnalysis.awarenessScore,
        goalCount:
          architectureAnalysis.goalCount,
        stalledGoals:
          architectureAnalysis.stalledGoals,
        recommendedReasoningAction:
          reasoningFocus === "goal_recovery"
            ? "Reason about blocked goals first"
            : reasoningFocus === "awareness_improvement"
            ? "Reason about weak skills and awareness gaps"
            : "Continue stable reasoning",
      },

      activeProcesses: [
        "memory analysis",
        "goal prioritization",
        "autonomous monitoring",
        "workflow coordination",
        "self-improvement",
      ],
    },

    timestamp: new Date().toISOString(),
  };
}