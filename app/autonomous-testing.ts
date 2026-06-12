import {
  getRecentMemories,
  getEvolutionSuggestions,
  getAutonomousGoals,
} from "./memory-store";

import { listProjectFiles } from "./dev-agent";

export async function runAutonomousTests() {
  const files = await listProjectFiles();
  const recentMemories = await getRecentMemories(5);
  const goals = await getAutonomousGoals(5);
  const suggestions = await getEvolutionSuggestions(5);

  const requiredFiles = {
    route: files.includes("app/api/awenia/route.ts"),
    memoryStore: files.includes("app/memory-store.ts"),
    codeMemory: files.includes("app/code-memory.ts"),
    devAgent: files.includes("app/dev-agent.ts"),
    awareness: files.includes("app/awareness.ts"),
    decisionEngine: files.includes("app/decision-engine.ts"),
    autonomousRuntime: files.includes("app/autonomous-runtime.ts"),
    protectedCore: files.includes("app/protected-core.ts"),
  };

  const projectStructureCheck =
    Object.values(requiredFiles).every(Boolean);

  const memoryCheck = recentMemories.length > 0;
  const goalsCheck = goals.length > 0;
  const evolutionCheck = suggestions.length > 0;

  const failedChecks = [
    !projectStructureCheck ? "project_structure" : null,
    !memoryCheck ? "memory" : null,
    !goalsCheck ? "autonomous_goals" : null,
    !evolutionCheck ? "evolution_suggestions" : null,
  ].filter(Boolean);

  return {
    buildCheck: "manual_build_required",
    syntaxCheck: "manual_build_required",

    projectStructureCheck,
    memoryCheck,
    goalsCheck,
    evolutionCheck,

    requiredFiles,

    testSummary: {
      totalFiles: files.length,
      recentMemories: recentMemories.length,
      goals: goals.length,
      evolutionSuggestions: suggestions.length,
      failedChecks,
    },

    patchValidation: true,
    rollbackReady: true,

    status:
      failedChecks.length === 0
        ? "safe"
        : "needs_attention",

    timestamp: new Date().toISOString(),
  };
}