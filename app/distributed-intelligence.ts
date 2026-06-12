import { Agents } from "./agents";
import { runReasoningNetwork } from "./reasoning-network";
import { runCognitiveEvolutionNetwork } from "./cognitive-evolution-network";

export async function runDistributedIntelligence() {
  const reasoning =
    await runReasoningNetwork();

  const evolution =
    await runCognitiveEvolutionNetwork();

  const agentCount =
    Object.keys(Agents).length;

  const reasoningActive =
    reasoning.reasoningNetwork?.active || false;

  return {
    distributedIntelligence: {
      active: true,

      agents: Object.keys(Agents),

      intelligence: {
        distributed: agentCount > 1,
        autonomous: reasoningActive,
        adaptive: true,
        persistent: true,
      },

      metrics: {
        agentCount,
        reasoningActive,
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