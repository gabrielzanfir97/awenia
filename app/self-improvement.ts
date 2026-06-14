import { makeAutonomousDecision } from "./decision-engine";
import { executeAgentWorkflow } from "./agent-orchestrator";
import { buildAwarenessState } from "./awareness";

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

export async function runSelfImprovementCycle() {
  console.log("SELF_IMPROVEMENT_RUNNING");

  const startedAt = new Date().toISOString();

  try {
    const awareness = await buildAwarenessState();

    const weakSkills = awareness.awareness?.weakSkills || [];
    const pendingUpgrades = awareness.awareness?.pendingUpgrades?.length || 0;
    const activeGoals = awareness.awareness?.activeGoals?.length || 0;
    const memoryLoad = calculateMemoryLoad(awareness);

    const decision = makeAutonomousDecision({
      memoryLoad,
      pendingUpgrades,
      weakSkills,
      activeGoals,
    });

    const workflow = await executeAgentWorkflow(
      decision.priority,
      `${decision.action}. Reason: ${decision.reason}`
    );

    let reflectionCreated = false;
    let suggestionCreated = false;

    if (weakSkills.length > 0) {
      await createAutonomousReflection(
        `Self-improvement detected weak skills: ${weakSkills.join(", ")}`,
        weakSkills.join(", "),
        `Execute learning and workflow improvement for ${weakSkills[0]}`
      );

      reflectionCreated = true;
    }

    if (
      decision.priority === "coding" &&
      !hasPendingSuggestion(awareness, "coding")
    ) {
      await createEvolutionSuggestion(
        "Improve coding capability",
        "Coding was detected as a weak skill by the self-improvement cycle.",
        8
      );

      suggestionCreated = true;
    }

    return {
      status: workflow.success ? "completed" : "needs_attention",

      awareness,

      decision,

      workflow,

      improvements: {
        reflectionsCreated: reflectionCreated,
        suggestionsCreated: suggestionCreated,
        memoryLoad,
        weakSkills,
        pendingUpgrades,
        activeGoals,
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

      error: error?.message || "Unknown self-improvement error",

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      timestamp: new Date().toISOString(),
    };
  }
}