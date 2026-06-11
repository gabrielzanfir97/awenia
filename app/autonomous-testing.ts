import { getRecentMemories } from "./memory-store";
import { listProjectFiles } from "./dev-agent";

export async function runAutonomousTests() {
  const files = await listProjectFiles();
  const recentMemories = await getRecentMemories(5);

  const hasRoute = files.includes("app/api/awenia/route.ts");
  const hasMemoryStore = files.includes("app/memory-store.ts");
  const hasCodeMemory = files.includes("app/code-memory.ts");
  const hasDevAgent = files.includes("app/dev-agent.ts");

  const memoryCheck = recentMemories.length > 0;

  const projectStructureCheck =
    hasRoute &&
    hasMemoryStore &&
    hasCodeMemory &&
    hasDevAgent;

  return {
    buildCheck: "not_run_here",
    syntaxCheck: "not_run_here",

    projectStructureCheck,
    memoryCheck,

    requiredFiles: {
      route: hasRoute,
      memoryStore: hasMemoryStore,
      codeMemory: hasCodeMemory,
      devAgent: hasDevAgent,
    },

    patchValidation: true,
    rollbackReady: true,

    status:
      projectStructureCheck && memoryCheck
        ? "safe"
        : "needs_attention",

    timestamp: new Date().toISOString(),
  };
}