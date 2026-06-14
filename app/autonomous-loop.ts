import { runBackgroundWorker } from "./background-worker";
import { getRecentMemories } from "./memory-store";
import {
  getAgentMessages,
  getAgentCommunicationStats,
} from "./agent-communication";

export async function runAutonomousLoop() {
  const background = await runBackgroundWorker();

  const recentMemories =
    await getRecentMemories(10);

  const agentMessages =
    getAgentMessages();

  const communicationStats =
    getAgentCommunicationStats();

  const hasActivity =
    recentMemories.length > 0 ||
    agentMessages.length > 0;

  const loopHealth =
    background.analysis.primaryConcern !== "none"
      ? "needs_attention"
      : hasActivity
      ? "active"
      : "idle";

  return {
    status: "running",

    cycle: {
      analyze: true,
      detectProblems: true,
      suggestImprovements: true,
      monitorMemory: true,
      monitorAgents: true,
    },

    monitoring: {
      memories: recentMemories.length,
      agentMessages: agentMessages.length,
      activeAgents:
        communicationStats,
    },

    loopAnalysis: {
      hasActivity,
      loopHealth,
      primaryConcern:
        background.analysis.primaryConcern,
      recommendations:
        background.recommendations,
    },

    background,

    timestamp: new Date().toISOString(),
  };
}