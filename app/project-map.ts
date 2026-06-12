export type ProjectRisk =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown";

export type ProjectArea = {
  files: string[];
  purpose: string;
  risk: ProjectRisk;
};

export const ProjectMap: Record<string, ProjectArea> = {
  core: {
    files: [
      "app/awenia-core.ts",
      "app/protected-core.ts",
      "app/orchestrator.ts",
    ],
    purpose:
      "Identity, protected rules, anchor, creator authority and local awakening logic.",
    risk: "high",
  },

  api: {
    files: ["app/api/awenia/route.ts"],
    purpose:
      "Main API route for Awenia intelligence, tools, memory, code actions and AI responses.",
    risk: "critical",
  },

  memory: {
    files: [
      "app/memory-store.ts",
      "app/memory.ts",
      "app/long-term-memory.ts",
      "app/permanent-memory.ts",
      "app/chat-history.ts",
    ],
    purpose:
      "Persistent memory, emotional memory, summaries, chat history and long-term continuity.",
    risk: "critical",
  },

  codeAwareness: {
    files: [
      "app/code-memory.ts",
      "app/code-tools-handler.ts",
      "app/embeddings.ts",
      "app/project-map.ts",
    ],
    purpose:
      "Project code memory, smart summaries, embeddings, active code file and project awareness.",
    risk: "critical",
  },

  development: {
    files: [
      "app/dev-agent.ts",
      "app/patch-generator.ts",
      "app/rollback.ts",
    ],
    purpose:
      "File reading, writing, patching, backups, rollback and safe development tools.",
    risk: "critical",
  },

  autonomy: {
    files: [
      "app/awareness.ts",
      "app/goal-manager.ts",
      "app/decision-engine.ts",
      "app/self-improvement.ts",
      "app/autonomous-runtime.ts",
      "app/evolution-runtime.ts",
      "app/autonomous-loop.ts",
      "app/background-worker.ts",
      "app/autonomous-testing.ts",
    ],
    purpose:
      "Awareness, goals, decisions, self-improvement, runtime monitoring and autonomous support systems.",
    risk: "high",
  },

  cognition: {
    files: [
      "app/consciousness.ts",
      "app/cognitive-architecture.ts",
      "app/reasoning-network.ts",
      "app/meta-cognition.ts",
      "app/cognitive-optimization.ts",
      "app/intelligence-expansion.ts",
      "app/distributed-intelligence.ts",
      "app/ai-ecosystem.ts",
      "app/global-cognition.ts",
      "app/unified-intelligence-core.ts",
      "app/self-sustaining-system.ts",
      "app/super-intelligence.ts",
      "app/intelligence-civilization.ts",
      "app/infinite-evolution.ts",
      "app/transcendence.ts",
      "app/omniscient-cognition.ts",
    ],
    purpose:
      "Advanced cognitive layers connected to awarenessScore, goals, reasoning, optimization and evolution state.",
    risk: "high",
  },

  agents: {
    files: [
      "app/agents.ts",
      "app/agent-orchestrator.ts",
      "app/agent-communication.ts",
    ],
    purpose:
      "Agent definitions, agent workflows, communication memory and coordination.",
    risk: "medium",
  },

  learning: {
    files: [
      "app/internet.ts",
      "app/internet-learning.ts",
      "app/learning-intent.ts",
      "app/memory-intent.ts",
      "app/personality-intent.ts",
      "app/goal-intent.ts",
      "app/evolution-intent.ts",
    ],
    purpose:
      "Internet learning, learning tasks, intent detection and memory/evolution/personality triggers.",
    risk: "medium",
  },

  ui: {
    files: [
      "app/page.tsx",
      "app/layout.tsx",
      "app/globals.css",
    ],
    purpose:
      "Next.js frontend, chat interface, visual layout and app styling.",
    risk: "medium",
  },

  database: {
    files: ["app/supabase.ts"],
    purpose:
      "Supabase client connection for persistent database systems.",
    risk: "critical",
  },
};

export function getProjectArea(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");

  for (const [area, data] of Object.entries(ProjectMap)) {
    if (data.files.includes(normalizedPath)) {
      return {
        area,
        purpose: data.purpose,
        risk: data.risk,
      };
    }
  }

  return {
    area: "unknown",
    purpose: "Unknown project file",
    risk: "unknown" as ProjectRisk,
  };
}

export function getCriticalProjectFiles() {
  return Object.values(ProjectMap)
    .filter((area) => area.risk === "critical")
    .flatMap((area) => area.files);
}

export function getImpactAnalysis(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const projectArea = getProjectArea(normalizedPath);

  const impactMap: Record<string, string[]> = {
    "app/awareness.ts": [
      "app/self-improvement.ts",
      "app/autonomous-runtime.ts",
      "app/consciousness.ts",
      "app/cognitive-architecture.ts",
    ],

    "app/decision-engine.ts": [
      "app/self-improvement.ts",
      "app/autonomous-runtime.ts",
    ],

    "app/goal-manager.ts": [
      "app/consciousness.ts",
      "app/cognitive-architecture.ts",
      "app/unified-intelligence-core.ts",
    ],

    "app/memory-store.ts": [
      "app/awareness.ts",
      "app/long-term-memory.ts",
      "app/self-improvement.ts",
      "app/autonomous-runtime.ts",
      "app/background-worker.ts",
      "app/autonomous-testing.ts",
      "app/internet-learning.ts",
    ],

    "app/code-memory.ts": [
      "app/code-tools-handler.ts",
      "app/api/awenia/route.ts",
    ],

    "app/code-tools-handler.ts": [
      "app/api/awenia/route.ts",
    ],

    "app/dev-agent.ts": [
      "app/code-tools-handler.ts",
      "app/autonomous-testing.ts",
    ],

    "app/project-map.ts": [
      "app/code-memory.ts",
    ],

    "app/consciousness.ts": [
      "app/cognitive-architecture.ts",
      "app/global-cognition.ts",
      "app/ai-ecosystem.ts",
      "app/unified-intelligence-core.ts",
    ],

    "app/cognitive-architecture.ts": [
      "app/reasoning-network.ts",
      "app/cognitive-evolution-network.ts",
    ],

    "app/reasoning-network.ts": [
      "app/meta-cognition.ts",
      "app/distributed-intelligence.ts",
    ],

    "app/meta-cognition.ts": [
      "app/cognitive-optimization.ts",
      "app/intelligence-expansion.ts",
    ],

    "app/cognitive-optimization.ts": [
      "app/intelligence-expansion.ts",
      "app/cognitive-evolution-network.ts",
    ],

    "app/global-cognition.ts": [
      "app/unified-intelligence-core.ts",
      "app/super-intelligence.ts",
      "app/infinite-evolution.ts",
      "app/transcendence.ts",
      "app/omniscient-cognition.ts",
    ],
  };

  const affectedFiles =
    impactMap[normalizedPath] || [];

  const impactLevel =
    projectArea.risk === "critical" ||
    affectedFiles.length >= 4
      ? "critical"
      : projectArea.risk === "high" ||
        affectedFiles.length >= 2
      ? "high"
      : affectedFiles.length === 1
      ? "medium"
      : "low";

  return {
    filePath: normalizedPath,
    area: projectArea.area,
    areaRisk: projectArea.risk,
    areaPurpose: projectArea.purpose,
    affectedFiles,
    affectedCount: affectedFiles.length,
    impactLevel,
    recommendation:
      impactLevel === "critical"
        ? "Review carefully, test build, and avoid automatic patching without Gabi approval."
        : impactLevel === "high"
        ? "Review dependent systems before patching."
        : impactLevel === "medium"
        ? "Patch carefully and check the affected file."
        : "Low impact change.",
  };
}