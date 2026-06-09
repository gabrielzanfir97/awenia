import { buildAwarenessState } from "./awareness";
import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";

export async function runAutonomousRuntime() {
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
    },

    timestamp: new Date().toISOString(),
  };
}