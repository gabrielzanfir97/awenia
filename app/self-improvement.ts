import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";

export async function runSelfImprovementCycle() {
  const decision = makeAutonomousDecision({
    errors: 0,
    memoryLoad: 45,
    pendingUpgrades: 1,
  });

  const workflow = coordinateAgents(
    decision.priority
  );

  return {
    decision,
    workflow,
    status: "running",
    timestamp: new Date().toISOString(),
  };
}