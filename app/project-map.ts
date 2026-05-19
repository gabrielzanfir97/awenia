export const ProjectMap = {
  ui: {
    mainPage: "app/page.tsx",
    purpose: "Main Next.js chat UI, buttons, input, message layout and visual interface.",
  },

  api: {
    aweniaRoute: "app/api/awenia/route.ts",
    purpose: "Main API route for Awenia intelligence, tools, memory, code actions and AI responses.",
  },

  memory: {
    store: "app/memory-store.ts",
    logic: "app/memory.ts",
    codeMemory: "app/code-memory.ts",
    purpose: "Persistent memory, emotional memory, project memory and code memory.",
  },

  evolution: {
    file: "app/evolution.ts",
    purpose: "Awenia self-improvement, reflections, evolution analysis and background evolution.",
  },

  orchestration: {
    file: "app/orchestrator.ts",
    purpose: "Local routing and local awakening logic before AI API calls.",
  },

  internet: {
    file: "app/internet.ts",
    purpose: "Internet learning and search system.",
  },

  development: {
    devAgent: "app/dev-agent.ts",
    projectMap: "app/project-map.ts",
    purpose: "File reading, writing, patching, project structure and developer tools.",
  },

  core: {
    file: "app/awenia-core.ts",
    purpose: "Awenia core identity, personality, anchor and base mission.",
  },

  supabase: {
    file: "app/supabase.ts",
    purpose: "Supabase client connection for persistent database memory.",
  },
};