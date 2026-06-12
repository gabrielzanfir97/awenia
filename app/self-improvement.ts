import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";
import { buildAwarenessState } from "./awareness";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

export async function runSelfImprovementCycle() {
  console.log("SELF_IMPROVEMENT_RUNNING");
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

  if (weakSkills.length > 0) {
    await createAutonomousReflection(
      `Detected weak skills: ${weakSkills.join(", ")}`,
      weakSkills.join(", "),
      `Create learning direction for ${weakSkills[0]}`
    );
  }

  if (
    decision.priority === "coding"
  ) {
    await createEvolutionSuggestion(
      "Improve coding capability",
      "Coding identified as weak skill",
      8
    );
  }

  return {
    awareness,
    decision,
    workflow,

    improvements: {
      reflectionsCreated:
        weakSkills.length > 0,
      suggestionsCreated:
        decision.priority === "coding",
    },

    status: "running",
    timestamp: new Date().toISOString(),
  };
}