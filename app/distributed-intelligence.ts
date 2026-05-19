import { Agents } from "./agents";
import { runReasoningNetwork } from "./reasoning-network";
import { runCognitiveEvolutionNetwork } from "./cognitive-evolution-network";

export async function runDistributedIntelligence() {
  const reasoning =
    await runReasoningNetwork();

  const evolution =
    await runCognitiveEvolutionNetwork();

  return {
    distributedIntelligence: {
      active: true,

      agents: Object.keys(Agents),

      intelligence: {
        distributed: true,
        autonomous: true,
        adaptive: true,
        persistent: true,
      },

      reasoning,

      evolution,

      activeSystems: [
        "autonomous reasoning",
        "meta cognition",
        "adaptive intelligence",
        "goal coordination",
        "long-term memory",
        "continuous evolution",
      ],
    },

    timestamp: new Date().toISOString(),
  };
}