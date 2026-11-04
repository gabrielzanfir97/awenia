import { buildAwarenessState } from "./awareness";
import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

function calculateMemoryLoad(awareness: any) {
  const memoryStats = awareness.awareness?.memoryStats || [];

  const totalMemories = memoryStats.reduce(
    (sum: number, item: any) => sum + (item.count || 0),
    0
  );

  return Math.max(0, Math.min(100, Math.round(totalMemories / 5)));
}

function hasPendingSuggestion(awareness: any, keyword: string) {
  const pendingUpgrades = awareness.awareness?.pendingUpgrades || [];

  return pendingUpgrades.some((item: any) =>
    `${item.suggestion || ""}`.toLowerCase().includes(keyword.toLowerCase())
  );
}

export async function runAutonomousRuntime() {
  console.log("AUTONOMOUS_RUNTIME_RUNNING");

  const startedAt = new Date().toISOString();

  try {
    const awareness = await buildAwarenessState();

    const weakSkills = awareness.awareness?.weakSkills || [];
    const pendingUpgrades = awareness.awareness?.pendingUpgrades?.length || 0;
    const activeGoals = awareness.awareness?.activeGoals?.length || 0;
    const memoryLoad = calculateMemoryLoad(awareness);
    const awarenessScore = awareness.awareness?.awarenessScore || 0;

    const decision = makeAutonomousDecision({
      memoryLoad,
      pendingUpgrades,
      weakSkills,
      activeGoals,
    });

    const workflow = coordinateAgents(
      decision.priority,
      `${decision.action}. Reason: ${decision.reason}`
    );

    let reflectionCreated = false;
    let suggestionCreated = false;

    if (decision.priority !== "monitor") {
      await createAutonomousReflection(
        `Autonomous runtime selected priority: ${decision.priority}`,
        awareness.awareness?.primaryProblem || "No primary problem detected",
        decision.action
      );

      reflectionCreated = true;
    }

    if (
      decision.priority === "upgrade" &&
      pendingUpgrades > 0 &&
      !hasPendingSuggestion(awareness, "review pending autonomous upgrades")
    ) {
      await createEvolutionSuggestion(
        "Review pending autonomous upgrades",
        "Autonomous runtime detected pending evolution suggestions and selected upgrade priority.",
        7
      );

      suggestionCreated = true;
    }

    const runtimeStatus = decision.priority === "monitor"
      ? "monitoring"
      : "needs_attention";

    return {
      status: runtimeStatus,

      awareness,

      decision,

      workflow,

      runtime: {
        autonomous: false,
        monitoring: workflow.status !== "failed",
        learning: false,
        selfImprovement: false,
        actionTaken: reflectionCreated || suggestionCreated,
        memoryLoad,
        awarenessScore,
      },

      runtimeAnalysis: {
        primaryProblem: awareness.awareness?.primaryProblem,
        recommendedAction: awareness.awareness?.recommendedAction,
        awarenessScore,
        memoryLoad,
        weakSkills,
        pendingUpgrades,
        activeGoals,
        reflectionCreated,
        suggestionCreated,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
        workflowStatus: workflow.status,
        workflowConfidence: workflow.confidence,
        workflowMessages: workflow.messages,
        agentState: workflow.agentState,
        communicationStats: workflow.communicationStats,
      },

      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: "failed",

      error: error?.message || "Unknown autonomous runtime error",

      runtime: {
        autonomous: false,
        monitoring: false,
        learning: false,
        selfImprovement: false,
        actionTaken: false,
      },

      runtimeAnalysis: {
        primaryProblem: "Autonomous runtime failed",
        recommendedAction: "Review runtime error before continuing autonomy.",
        awarenessScore: 0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      timestamp: new Date().toISOString(),
    };
  }
}