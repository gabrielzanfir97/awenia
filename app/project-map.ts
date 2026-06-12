export const ProjectMap = {
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
    files: [
      "app/api/awenia/route.ts",
    ],
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
    files: [
      "app/supabase.ts",
    ],
    purpose:
      "Supabase client connection for persistent database systems.",
    risk: "critical",
  },
};

export function getProjectArea(filePath: string) {
  for (const [area, data] of Object.entries(ProjectMap)) {
    if (data.files.includes(filePath)) {
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
    risk: "unknown",
  };
}

export function getCriticalProjectFiles() {
  return Object.values(ProjectMap)
    .filter((area) => area.risk === "critical")
    .flatMap((area) => area.files);
}