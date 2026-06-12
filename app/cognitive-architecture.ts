import { buildConsciousnessState } from "./consciousness";
import { adaptSystemBehavior } from "./adaptive-intelligence";
import { manageAutonomousGoals } from "./goal-manager";

export async function buildCognitiveArchitecture() {
  const consciousness =
    await buildConsciousnessState();

  const adaptive =
    adaptSystemBehavior({
      errors: 0,
      memoryLoad: 40,
      successfulCycles: 12,
    });

  const goals =
    await manageAutonomousGoals();

  const awarenessScore =
    consciousness.consciousness.selfUnderstanding?.awarenessScore || 0;

  const goalCount =
    goals.goalAnalysis?.totalActiveGoals || 0;

  const stalledGoals =
    goals.goalAnalysis?.stalledGoals || 0;

  const architectureHealth =
    awarenessScore >= 80 && stalledGoals === 0
      ? "strong"
      : awarenessScore >= 60
      ? "developing"
      : "needs_attention";

  const mainCognitiveFocus =
    stalledGoals > 0
      ? "goal_recovery"
      : awarenessScore < 70
      ? "awareness_improvement"
      : "stable_reasoning";

  return {
    cognitiveArchitecture: {
      consciousness,

      adaptive,

      goals,

      cognition: {
        reasoning: true,
        awareness: true,
        memory: true,
        evolution: true,
        coordination: true,
      },

      architectureAnalysis: {
        awarenessScore,
        goalCount,
        stalledGoals,
        architectureHealth,
        mainCognitiveFocus,
      },

      recommendedAction:
        mainCognitiveFocus === "goal_recovery"
          ? "Unblock stalled autonomous goals"
          : mainCognitiveFocus === "awareness_improvement"
          ? "Improve awareness score and reduce weak skills"
          : "Continue stable reasoning and monitoring",

      state: architectureHealth,
    },

    timestamp: new Date().toISOString(),
  };
}