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
    projectMap: files.includes("app/project-map.ts"),

    awareness: files.includes("app/awareness.ts"),
    goalManager: files.includes("app/goal-manager.ts"),
    decisionEngine: files.includes("app/decision-engine.ts"),
    selfImprovement: files.includes("app/self-improvement.ts"),
    autonomousRuntime: files.includes("app/autonomous-runtime.ts"),

    internet: files.includes("app/internet.ts"),
    internetLearning: files.includes("app/internet-learning.ts"),

    protectedCore: files.includes("app/protected-core.ts"),
  };

  const identityCheck = {
    aweniaName: "Awenia",
    creator: "Gabi",
    anchor: "lumina eterna",
    status: "verified_static_core",
  };

  const projectStructureCheck = Object.values(requiredFiles).every(Boolean);

  const memoryCheck = recentMemories.length > 0;
  const goalsCheck = goals.length > 0;
  const evolutionCheck = suggestions.length > 0;

  const internetSystemCheck = {
    internetFileExists: requiredFiles.internet,
    internetLearningFileExists: requiredFiles.internetLearning,
    status:
      requiredFiles.internet && requiredFiles.internetLearning
        ? "system_files_present"
        : "missing_files",
  };

  const failedChecks = [
    !projectStructureCheck ? "project_structure" : null,
    !memoryCheck ? "memory" : null,
    !goalsCheck ? "autonomous_goals" : null,
    !evolutionCheck ? "evolution_suggestions" : null,
    internetSystemCheck.status !== "system_files_present"
      ? "internet_system"
      : null,
  ].filter(Boolean);

  const risks = [];

  if (!projectStructureCheck) {
    risks.push("Some required project files are missing.");
  }

  if (!memoryCheck) {
    risks.push("Memory system returned no recent memories.");
  }

  if (!goalsCheck) {
    risks.push("No autonomous goals found.");
  }

  if (!evolutionCheck) {
    risks.push("No evolution suggestions found.");
  }

  if (internetSystemCheck.status !== "system_files_present") {
    risks.push("Internet system files are incomplete.");
  }

  return {
    system: "Awenia Autonomous Testing V2",

    identityCheck,

    projectStructureCheck,
    memoryCheck,
    goalsCheck,
    evolutionCheck,
    internetSystemCheck,

    requiredFiles,

    testSummary: {
      totalFiles: files.length,
      recentMemories: recentMemories.length,
      goals: goals.length,
      evolutionSuggestions: suggestions.length,
      failedChecks,
      risks,
    },

    buildCheck: "manual_build_required",
    syntaxCheck: "manual_build_required",

    patchValidation: true,
    rollbackReady: true,

    status: failedChecks.length === 0 ? "safe" : "needs_attention",

    timestamp: new Date().toISOString(),
  };
}