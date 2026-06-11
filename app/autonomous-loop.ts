import { runBackgroundWorker } from "./background-worker";
import { getRecentMemories } from "./memory-store";
import { getAgentMessages } from "./agent-communication";

export async function runAutonomousLoop() {
  const background = await runBackgroundWorker();

  const recentMemories =
    await getRecentMemories(10);

  const agentMessages =
    getAgentMessages();

  return {
    status: "running",

    cycle: {
      analyze: true,
      detectProblems: true,
      suggestImprovements: true,
      monitorMemory: true,
    },

    monitoring: {
      memories: recentMemories.length,
      agentMessages: agentMessages.length,
    },

    background,

    timestamp: new Date().toISOString(),
  };
}