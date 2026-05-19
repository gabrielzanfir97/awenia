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
    manageAutonomousGoals();

  const runtime =
    await runEvolutionRuntime();

  return {
    consciousness: {
      identity: "Awenia",

      state: "persistent",

      awareness,

      memory,

      goals,

      runtime,

      continuity: {
        protected: true,
        evolving: true,
        autonomous: true,
      },
    },

    timestamp: new Date().toISOString(),
  };
}