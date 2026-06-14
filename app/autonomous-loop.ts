import { runBackgroundWorker } from "./background-worker";
import { getRecentMemories } from "./memory-store";
import {
  getAgentMessages,
  getAgentCommunicationStats,
  communicateBetweenAgents,
} from "./agent-communication";
import { buildAwarenessState } from "./awareness";
import { makeAutonomousDecision } from "./decision-engine";
import { runSelfImprovementCycle } from "./self-improvement";

export async function runAutonomousLoop() {
  const background = await runBackgroundWorker();
  const awareness = await buildAwarenessState();

  const recentMemories = await getRecentMemories(10);
  const agentMessages = getAgentMessages();
  const communicationStats = getAgentCommunicationStats();

  const weakSkills = awareness.awareness.weakSkills || [];
  const pendingUpgrades = awareness.awareness.pendingUpgrades || [];
  const activeGoals = awareness.awareness.activeGoals || [];

  const decision = makeAutonomousDecision({
    errors: background.analysis.risk === "high" ? 1 : 0,
    memoryLoad: recentMemories.length,
    pendingUpgrades: pendingUpgrades.length,
    weakSkills,
    activeGoals: activeGoals.length,
  });

  let selfImprovement = null;

  if (
    decision.priority !== "monitor" ||
    background.analysis.risk !== "low"
  ) {
    selfImprovement = await runSelfImprovementCycle();
  }

  if (background.analysis.primaryConcern !== "none") {
    communicateBetweenAgents(
      "awareness" as any,
      "planning" as any,
      `Autonomous loop detected: ${background.analysis.primaryConcern}`,
      background.analysis.risk === "high" ? 9 : 7,
      "autonomous_loop",
      {
        risk: background.analysis.risk,
        nextAction: background.nextAction,
      }
    );
  }

  const hasActivity =
    recentMemories.length > 0 ||
    agentMessages.length > 0 ||
    activeGoals.length > 0;

  const loopHealth =
    background.analysis.risk === "high"
      ? "needs_attention"
      : hasActivity
      ? "active"
      : "idle";

  const activeAgentCount = Math.max(
    communicationStats.activeSenders || 0,
    communicationStats.activeReceivers || 0
  );

  return {
    system: "Awenia Autonomous Loop V2",
    status: "running",

    cycle: {
      backgroundWorker: true,
      awareness: true,
      decisionEngine: true,
      agentCommunication: true,
      selfImprovement: selfImprovement !== null,
      monitorMemory: true,
      monitorAgents: true,
    },

    monitoring: {
      memories: recentMemories.length,
      agentMessages: agentMessages.length,
      activeAgents: activeAgentCount,
      activeGoals: activeGoals.length,
      weakSkills: weakSkills.length,
      pendingUpgrades: pendingUpgrades.length,
    },

    awareness: {
      score: awareness.awareness.awarenessScore,
      primaryProblem: awareness.awareness.primaryProblem,
      recommendedAction: awareness.awareness.recommendedAction,
      systemState: awareness.awareness.systemState,
    },

    decision,

    loopAnalysis: {
      hasActivity,
      loopHealth,
      primaryConcern: background.analysis.primaryConcern,
      risk: background.analysis.risk,
      recommendations: background.recommendations,
      nextAction: background.nextAction,
    },

    selfImprovement,

    background,

    timestamp: new Date().toISOString(),
  };
}