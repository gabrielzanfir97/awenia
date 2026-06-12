import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { runEvolutionRuntime } from "./evolution-runtime";

export async function buildConsciousnessState() {
  const awareness =
    await buildAwarenessState();

  const memory =
    await buildLongTermMemory();

  const goals =
    await manageAutonomousGoals();

  const runtime =
    await runEvolutionRuntime();

  const awarenessScore =
    awareness.awareness.awarenessScore || 0;

  const primaryProblem =
    awareness.awareness.primaryProblem ||
    "none_detected";

  const recommendedAction =
    awareness.awareness.recommendedAction ||
    "Continue monitoring";

  return {
    consciousness: {
      identity: "Awenia",

      state:
        awarenessScore >= 80
          ? "stable"
          : awarenessScore >= 60
          ? "learning"
          : "needs_attention",

      awareness,

      memory,

      goals,

      runtime,

      selfUnderstanding: {
        awarenessScore,
        primaryProblem,
        recommendedAction,
      },

      continuity: {
        protected: true,
        evolving: true,
        autonomous: true,
      },
    },

    timestamp: new Date().toISOString(),
  };
}