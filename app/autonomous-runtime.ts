import { buildAwarenessState } from "./awareness";
import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

export async function runAutonomousRuntime() {
  console.log("AUTONOMOUS_RUNTIME_RUNNING");
  const awareness =
    await buildAwarenessState();

  const weakSkills =
    awareness.awareness.weakSkills || [];

  const pendingUpgrades =
    awareness.awareness.pendingUpgrades?.length || 0;

  const activeGoals =
    awareness.awareness.activeGoals?.length || 0;

  const decision =
    makeAutonomousDecision({
      errors: 0,
      memoryLoad: 45,
      pendingUpgrades,
      weakSkills,
      activeGoals,
    });

  const workflow =
    coordinateAgents(
      decision.priority
    );

  if (decision.priority !== "monitor") {
    await createAutonomousReflection(
      `Autonomous runtime selected priority: ${decision.priority}`,
      awareness.awareness.primaryProblem || "No primary problem detected",
      decision.action
    );
  }

  if (pendingUpgrades > 0) {
    await createEvolutionSuggestion(
      "Review pending autonomous upgrades",
      "Autonomous runtime detected pending evolution suggestions",
      7
    );
  }

  return {
    status: "active",

    awareness,

    decision,

    workflow,

    runtime: {
      autonomous: true,
      monitoring: true,
      learning: true,
      selfImprovement: true,
      actionTaken:
        decision.priority !== "monitor",
    },

    runtimeAnalysis: {
      primaryProblem:
        awareness.awareness.primaryProblem,
      recommendedAction:
        awareness.awareness.recommendedAction,
      awarenessScore:
        awareness.awareness.awarenessScore,
    },

    timestamp: new Date().toISOString(),
  };
}