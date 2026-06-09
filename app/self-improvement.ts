import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";
import { buildAwarenessState } from "./awareness";

export async function runSelfImprovementCycle() {
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
    awareness,
    decision,
    workflow,
    status: "running",
    timestamp: new Date().toISOString(),
  };
}