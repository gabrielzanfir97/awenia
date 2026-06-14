export type ProjectModuleStatus =
  | "declared"
  | "connected"
  | "needs_review"
  | "high_risk"
  | "placeholder"
  | "unknown";

export type ProjectModuleRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ProjectModuleCategory =
  | "core"
  | "api"
  | "ui"
  | "memory"
  | "code"
  | "tools"
  | "security"
  | "autonomy"
  | "cognition"
  | "internet"
  | "intent"
  | "routing"
  | "agents"
  | "prompts"
  | "project"
  | "testing"
  | "voice"
  | "misc";

export type ProjectModule = {
  id: string;
  category: ProjectModuleCategory;
  name: string;
  files: string[];
  purpose: string;
  status: ProjectModuleStatus;
  risk: ProjectModuleRisk;
  dependsOn: string[];
  exportsExpected: string[];
  notes: string[];
};

export type ProjectMapState = {
  status: "loaded";
  modules: ProjectModule[];
  totalModules: number;
  totalFiles: number;
  highRiskFiles: string[];
  criticalFiles: string[];
  categories: Record<string, number>;
  truthPolicy: {
    mapIsDeclaredArchitecture: boolean;
    mapDoesNotConfirmFileExists: boolean;
    filesystemMustBeCheckedSeparately: boolean;
    buildStatusMustBeCheckedSeparately: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function normalizePath(filePath = "") {
  return filePath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export const PROJECT_MODULES: ProjectModule[] = [
  {
    id: "awenia_core",
    category: "core",
    name: "Awenia Core",
    files: [
      "app/awenia-core.ts",
      "app/personality.ts",
      "app/system-prompt.ts",
      "app/prompts.ts",
    ],
    purpose:
      "Identitatea Aweniei, regulile de adevăr, personalitatea și prompturile principale.",
    status: "connected",
    risk: "medium",
    dependsOn: [
      "routing",
      "skills",
      "intent-router",
      "security",
      "memory-store",
    ],
    exportsExpected: [
      "runAweniaCore",
      "buildAweniaCoreState",
      "buildSystemPrompt",
      "buildMessages",
      "buildPersonalityState",
    ],
    notes: [
      "Nu trebuie să inventeze statusuri.",
      "Gabi este creatorul.",
      "Ancora este lumina eterna.",
    ],
  },
  {
    id: "main_api",
    category: "api",
    name: "Main API Route",
    files: ["app/api/awenia/route.ts"],
    purpose:
      "Route-ul principal care primește mesajele, rulează tool-uri, citește memoria și cheamă AI-ul local.",
    status: "high_risk",
    risk: "high",
    dependsOn: [
      "orchestrator",
      "memory-store",
      "code-tools-handler",
      "system-tools-handler",
      "cognition-runtime",
    ],
    exportsExpected: ["POST"],
    notes: [
      "Fișier foarte sensibil.",
      "Nu trebuie modificat fără citire/verificare.",
      "Build-ul trebuie verificat separat.",
    ],
  },
  {
    id: "ui",
    category: "ui",
    name: "Chat UI",
    files: ["app/page.tsx", "app/layout.tsx", "app/ui.tsx"],
    purpose:
      "Interfața de chat Awenia, upload fișiere, afișare mesaje și UI Next.js.",
    status: "declared",
    risk: "medium",
    dependsOn: ["api"],
    exportsExpected: ["default"],
    notes: [
      "Poate avea componente client.",
      "Trebuie testat în browser după build.",
    ],
  },
  {
    id: "memory_system",
    category: "memory",
    name: "Memory System",
    files: [
      "app/memory-store.ts",
      "app/memory.ts",
      "app/long-term-memory.ts",
      "app/chat-history.ts",
      "app/memory-intent.ts",
      "app/embeddings.ts",
    ],
    purpose:
      "Memorie locală, memorie Supabase, rezumate, chat history, embeddings și intenții de memorie.",
    status: "connected",
    risk: "high",
    dependsOn: ["supabase"],
    exportsExpected: [
      "saveMemory",
      "getRecentMemories",
      "getMemorySummaries",
      "getAutonomousGoals",
      "buildMemoryState",
      "buildLongTermMemory",
    ],
    notes: [
      "Memoria runtime nu este același lucru cu memoria Supabase.",
      "Nu se afirmă salvare DB fără rezultat de scriere.",
    ],
  },
  {
    id: "supabase",
    category: "memory",
    name: "Supabase Client",
    files: ["app/supabase.ts"],
    purpose:
      "Client Supabase, verificare env și verificare reală conexiune prin query.",
    status: "connected",
    risk: "high",
    dependsOn: [],
    exportsExpected: [
      "supabase",
      "isSupabaseConfigured",
      "checkSupabaseHealth",
      "checkSupabaseTables",
    ],
    notes: [
      "Env prezent nu înseamnă conexiune verificată.",
      "Conexiunea se verifică separat prin query.",
    ],
  },
  {
    id: "code_memory",
    category: "code",
    name: "Code Memory",
    files: ["app/code-memory.ts", "app/code-tools-handler.ts"],
    purpose:
      "Memorie de cod, analiză importuri/exporturi/funcții, handler pentru read/write/patch/analyze.",
    status: "connected",
    risk: "high",
    dependsOn: [
      "dev-agent",
      "pending-actions",
      "embeddings",
      "memory-store",
    ],
    exportsExpected: [
      "rememberCodeFile",
      "saveCodeMemory",
      "searchCodeMemory",
      "extractImports",
      "extractExports",
      "extractFunctions",
    ],
    notes: [
      "Nu trebuie să ghicească fișiere.",
      "WRITE/PATCH trebuie să meargă prin pending approval.",
    ],
  },
  {
    id: "dev_tools",
    category: "tools",
    name: "Development Tools",
    files: [
      "app/dev-agent.ts",
      "app/patch-generator.ts",
      "app/rollback.ts",
      "app/pending-actions.ts",
    ],
    purpose:
      "Citire fișiere, scriere, patch, rollback, backup și acțiuni pending cu aprobare.",
    status: "connected",
    risk: "high",
    dependsOn: ["security", "code-memory"],
    exportsExpected: [
      "readProjectFile",
      "writeProjectFile",
      "patchProjectFile",
      "rollbackProjectFile",
      "createPendingPatchAction",
      "createPendingWriteAction",
      "rollbackFile",
    ],
    notes: [
      "Nu atinge .env, .git, node_modules.",
      "Rollback trebuie să creeze safety backup.",
      "Acțiunile riscante cer aprobare Gabi.",
    ],
  },
  {
    id: "security_layer",
    category: "security",
    name: "Security Layer",
    files: ["app/security.ts", "app/protected-core.ts"],
    purpose:
      "Protecție fișiere, reguli imuabile, aprobare Gabi și politică de adevăr.",
    status: "connected",
    risk: "critical",
    dependsOn: [],
    exportsExpected: [
      "validateSecurityAction",
      "validateCoreAction",
      "validateTruthClaim",
      "getProtectedCoreState",
    ],
    notes: [
      "Fișier critic.",
      "Nu trebuie modificat fără aprobare.",
      "Controlează adevărul și protecția proiectului.",
    ],
  },
  {
    id: "routing_orchestration",
    category: "routing",
    name: "Routing and Orchestration",
    files: [
      "app/routing.ts",
      "app/orchestrator.ts",
      "app/intent-router.ts",
      "app/skills.ts",
      "app/task-planner.ts",
      "app/tasks.ts",
    ],
    purpose:
      "Detectează ruta mesajului, skill-ul, intentul, planul și decide dacă se folosește AI, tool sau răspuns simplu.",
    status: "connected",
    risk: "medium",
    dependsOn: [
      "awenia-core",
      "security",
      "memory-store",
      "prompts",
      "personality",
    ],
    exportsExpected: [
      "analyzeRouting",
      "orchestrateMessage",
      "runIntentRouter",
      "runSkillSystem",
      "createTaskPlan",
      "createTask",
    ],
    notes: [
      "Mesajele simple trebuie să sară peste AI greu.",
      "Tool commands trebuie trimise la handler, nu la model.",
    ],
  },
  {
    id: "intent_system",
    category: "intent",
    name: "Intent Systems",
    files: [
      "app/learning-intent.ts",
      "app/memory-intent.ts",
      "app/personality-intent.ts",
      "app/goal-intent.ts",
      "app/evolution-intent.ts",
      "app/intent-router.ts",
    ],
    purpose:
      "Detectează când Gabi cere învățare, memorie, personalitate, obiective sau evoluție.",
    status: "connected",
    risk: "medium",
    dependsOn: ["memory-store", "security"],
    exportsExpected: [
      "analyzeLearningIntent",
      "analyzeMemoryIntent",
      "analyzePersonalityIntent",
      "analyzeGoalIntent",
      "analyzeEvolutionIntent",
      "runIntentRouter",
    ],
    notes: [
      "Nu trebuie să salveze duplicate.",
      "Evoluția riscantă cere aprobare.",
    ],
  },
  {
    id: "internet_system",
    category: "internet",
    name: "Internet System",
    files: ["app/internet.ts", "app/internet-learning.ts"],
    purpose:
      "Verifică internetul prin fetch real, caută Wikipedia și creează învățare verificată.",
    status: "connected",
    risk: "medium",
    dependsOn: ["memory-store"],
    exportsExpected: [
      "checkInternetConnection",
      "searchInternet",
      "learnFromInternet",
      "runInternetLearning",
    ],
    notes: [
      "Nu se afirmă internet activ fără fetch.",
      "Dacă fetch eșuează, cunoașterea online nu e verificată.",
    ],
  },
  {
    id: "agents",
    category: "agents",
    name: "Agents",
    files: [
      "app/agents.ts",
      "app/agent-orchestrator.ts",
      "app/agent-communication.ts",
    ],
    purpose:
      "Agenți interni pentru coding, memory, planning, debugging, evolution și comunicare între agenți.",
    status: "connected",
    risk: "medium",
    dependsOn: ["memory-store"],
    exportsExpected: [
      "findBestAgentsForTask",
      "executeAgentWorkflow",
      "coordinateAgents",
      "sendAgentMessage",
    ],
    notes: [
      "Agenții nu execută modificări riscante direct.",
      "Workflow-ul trebuie să fie verificabil.",
    ],
  },
  {
    id: "awareness_consciousness",
    category: "cognition",
    name: "Awareness and Consciousness",
    files: [
      "app/awareness.ts",
      "app/consciousness.ts",
      "app/long-term-memory.ts",
      "app/goal-manager.ts",
      "app/decision-engine.ts",
    ],
    purpose:
      "Construiește awareness real din memorie, goals, skills, evolution și decizii autonome.",
    status: "connected",
    risk: "medium",
    dependsOn: ["memory-store", "long-term-memory"],
    exportsExpected: [
      "buildAwarenessState",
      "buildConsciousnessState",
      "buildLongTermMemory",
      "manageAutonomousGoals",
      "makeAutonomousDecision",
    ],
    notes: [
      "Trebuie să citească date reale.",
      "Nu trebuie să pretindă omnisciență.",
    ],
  },
  {
    id: "autonomy_runtime",
    category: "autonomy",
    name: "Autonomy Runtime",
    files: [
      "app/self-improvement.ts",
      "app/autonomous-runtime.ts",
      "app/evolution-runtime.ts",
      "app/background-worker.ts",
      "app/autonomous-loop.ts",
      "app/autonomous-testing.ts",
      "app/cognition-runtime.ts",
    ],
    purpose:
      "Coordonează self-improvement, runtime autonom, evolution, worker, loop și teste autonome.",
    status: "connected",
    risk: "high",
    dependsOn: [
      "awareness",
      "decision-engine",
      "agent-orchestrator",
      "memory-store",
    ],
    exportsExpected: [
      "runSelfImprovementCycle",
      "runAutonomousRuntime",
      "runEvolutionRuntime",
      "runBackgroundWorker",
      "runAutonomousLoop",
      "runAutonomousTests",
      "runCognitionRuntime",
    ],
    notes: [
      "Nu trebuie să ruleze greu pentru mesaje simple.",
      "Loop-urile trebuie protejate anti-recursie.",
    ],
  },
  {
    id: "cognition_layers",
    category: "cognition",
    name: "Cognition Layers",
    files: [
      "app/cognitive-architecture.ts",
      "app/adaptive-intelligence.ts",
      "app/cognitive-optimization.ts",
      "app/meta-cognition.ts",
      "app/reasoning-network.ts",
      "app/distributed-intelligence.ts",
      "app/ai-ecosystem.ts",
      "app/super-intelligence.ts",
      "app/intelligence-expansion.ts",
      "app/cognitive-evolution-network.ts",
      "app/intelligence-civilization.ts",
      "app/infinite-evolution.ts",
      "app/transcendence.ts",
      "app/global-cognition.ts",
      "app/self-sustaining-system.ts",
      "app/unified-intelligence-core.ts",
      "app/omniscient-cognition.ts",
    ],
    purpose:
      "Straturi cognitive superioare controlate, bazate pe awareness real, nu pe afirmații false.",
    status: "connected",
    risk: "high",
    dependsOn: [
      "awareness",
      "memory-store",
      "security",
      "decision-engine",
      "agent-orchestrator",
    ],
    exportsExpected: [
      "buildCognitiveArchitecture",
      "adaptSystemBehavior",
      "optimizeCognition",
      "runMetaCognition",
      "runReasoningNetwork",
      "runGlobalCognition",
      "runOmniscientCognition",
    ],
    notes: [
      "Numele mari nu înseamnă puteri reale.",
      "Trebuie să explice limitele și nivelul verificat.",
      "Nu se face auto-evoluție fără aprobare.",
    ],
  },
  {
    id: "project_awareness",
    category: "project",
    name: "Project Awareness",
    files: [
      "app/project-map.ts",
      "app/project-state.ts",
      "app/system-tools-handler.ts",
    ],
    purpose:
      "Hartă declarată a proiectului, status proiect și handlers pentru status/teste/background.",
    status: "connected",
    risk: "medium",
    dependsOn: [
      "awareness",
      "memory-store",
      "autonomous-testing",
      "omniscient-cognition",
    ],
    exportsExpected: [
      "getProjectMap",
      "buildProjectState",
      "handleAweniaStatus",
      "handleRunAutonomousTests",
    ],
    notes: [
      "Project map nu confirmă existența fișierelor.",
      "Statusul real cere verificare separată.",
    ],
  },
  {
    id: "testing_debug",
    category: "testing",
    name: "Testing and Debug",
    files: ["app/autonomous-testing.ts", "app/self-debug.ts"],
    purpose:
      "Teste autonome și analiză de erori.",
    status: "connected",
    risk: "medium",
    dependsOn: ["awareness", "agents", "decision-engine"],
    exportsExpected: ["runAutonomousTests", "analyzeError"],
    notes: [
      "Erorile reale trebuie folosite ca sursă.",
      "Nu se inventează build trecut.",
    ],
  },
  {
    id: "voice",
    category: "voice",
    name: "Voice",
    files: ["app/voice.ts", "app/voice-ai.ts"],
    purpose:
      "Voce Awenia pentru fază viitoare.",
    status: "needs_review",
    risk: "medium",
    dependsOn: [],
    exportsExpected: [],
    notes: [
      "Vocea vine după stabilizarea core-ului.",
      "Nu este prioritatea fazei actuale.",
    ],
  },
  {
    id: "local_ai",
    category: "core",
    name: "Local AI Provider",
    files: ["app/local-ai-provider.ts", "app/ai-provider-router.ts"],
    purpose:
      "Conectare locală la model AI și routing provider.",
    status: "needs_review",
    risk: "high",
    dependsOn: ["prompts", "routing"],
    exportsExpected: [],
    notes: [
      "Providerul local poate fi cauza întârzierilor.",
      "Nu trebuie confundat cu Awenia Core.",
    ],
  },
];

export const HIGH_RISK_FILES = unique(
  PROJECT_MODULES.filter(
    (module) => module.risk === "high" || module.risk === "critical"
  ).flatMap((module) => module.files)
);

export const CRITICAL_FILES = unique(
  PROJECT_MODULES.filter((module) => module.risk === "critical").flatMap(
    (module) => module.files
  )
);

export function getProjectModules() {
  return PROJECT_MODULES;
}

export function getProjectMap(): ProjectMapState {
  const files = unique(PROJECT_MODULES.flatMap((module) => module.files));

  const categories: Record<string, number> = {};

  for (const module of PROJECT_MODULES) {
    categories[module.category] = (categories[module.category] || 0) + 1;
  }

  return {
    status: "loaded",
    modules: PROJECT_MODULES,
    totalModules: PROJECT_MODULES.length,
    totalFiles: files.length,
    highRiskFiles: HIGH_RISK_FILES,
    criticalFiles: CRITICAL_FILES,
    categories,
    truthPolicy: {
      mapIsDeclaredArchitecture: true,
      mapDoesNotConfirmFileExists: true,
      filesystemMustBeCheckedSeparately: true,
      buildStatusMustBeCheckedSeparately: true,
    },
    timestamp: now(),
  };
}

export function getProjectFiles() {
  return unique(PROJECT_MODULES.flatMap((module) => module.files)).sort();
}

export function getHighRiskProjectFiles() {
  return HIGH_RISK_FILES;
}

export function getCriticalProjectFiles() {
  return CRITICAL_FILES;
}

export function getProjectModuleById(id: string) {
  return PROJECT_MODULES.find((module) => module.id === id) || null;
}

export function getProjectModuleForFile(filePath: string) {
  const normalized = normalizePath(filePath).toLowerCase();

  return (
    PROJECT_MODULES.find((module) =>
      module.files.some(
        (file) => normalizePath(file).toLowerCase() === normalized
      )
    ) || null
  );
}

export function getProjectModulesByCategory(
  category: ProjectModuleCategory
) {
  return PROJECT_MODULES.filter((module) => module.category === category);
}

export function searchProjectMap(query = "") {
  const lower = query.toLowerCase().trim();

  if (!lower) {
    return {
      status: "loaded",
      query,
      results: PROJECT_MODULES,
      count: PROJECT_MODULES.length,
      timestamp: now(),
    };
  }

  const results = PROJECT_MODULES.filter((module) => {
    const haystack = [
      module.id,
      module.category,
      module.name,
      module.purpose,
      module.files.join(" "),
      module.dependsOn.join(" "),
      module.exportsExpected.join(" "),
      module.notes.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(lower);
  });

  return {
    status: "loaded",
    query,
    results,
    count: results.length,
    timestamp: now(),
  };
}

export function analyzeProjectFile(filePath: string) {
  const normalized = normalizePath(filePath);
  const module = getProjectModuleForFile(normalized);

  const risk: ProjectModuleRisk =
    CRITICAL_FILES.includes(normalized)
      ? "critical"
      : HIGH_RISK_FILES.includes(normalized)
        ? "high"
        : module?.risk || "medium";

  return {
    filePath: normalized,
    knownInMap: Boolean(module),
    module,
    risk,
    requiresApproval:
      risk === "medium" || risk === "high" || risk === "critical",
    note: module
      ? module.purpose
      : "Fișierul nu este în harta declarată. Trebuie verificat separat.",
    truthPolicy: {
      mapDoesNotConfirmFileExists: true,
      mustReadFileForRealContent: true,
    },
    timestamp: now(),
  };
}

export function buildProjectMapContext(query = "") {
  const modules = query
    ? searchProjectMap(query).results
    : PROJECT_MODULES;

  if (modules.length === 0) {
    return "Nu există module în project-map pentru această căutare.";
  }

  return modules
    .map((module, index) => {
      return [
        `${index + 1}. ${module.name} (${module.id})`,
        `Category: ${module.category}`,
        `Status: ${module.status}`,
        `Risk: ${module.risk}`,
        `Files: ${module.files.join(", ")}`,
        `Purpose: ${module.purpose}`,
        `Depends on: ${module.dependsOn.join(", ") || "none"}`,
        `Notes: ${module.notes.join(" ")}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function getProjectArchitecture() {
  return {
    core: getProjectModulesByCategory("core"),
    api: getProjectModulesByCategory("api"),
    ui: getProjectModulesByCategory("ui"),
    memory: getProjectModulesByCategory("memory"),
    code: getProjectModulesByCategory("code"),
    tools: getProjectModulesByCategory("tools"),
    security: getProjectModulesByCategory("security"),
    autonomy: getProjectModulesByCategory("autonomy"),
    cognition: getProjectModulesByCategory("cognition"),
    internet: getProjectModulesByCategory("internet"),
    intent: getProjectModulesByCategory("intent"),
    routing: getProjectModulesByCategory("routing"),
    agents: getProjectModulesByCategory("agents"),
    prompts: getProjectModulesByCategory("prompts"),
    project: getProjectModulesByCategory("project"),
    testing: getProjectModulesByCategory("testing"),
    voice: getProjectModulesByCategory("voice"),
    misc: getProjectModulesByCategory("misc"),
    timestamp: now(),
  };
}

export function getProjectMapState() {
  return getProjectMap();
}

export function runProjectMap(query = "") {
  return {
    status: "loaded",
    map: getProjectMap(),
    search: query ? searchProjectMap(query) : null,
    context: buildProjectMapContext(query),
    timestamp: now(),
  };
}

export function getProjectModuleNames() {
  return PROJECT_MODULES.map((module) => module.name);
}

export function getProjectModuleIds() {
  return PROJECT_MODULES.map((module) => module.id);
}

export function getProjectDependencies(moduleId: string) {
  const module = getProjectModuleById(moduleId);

  if (!module) {
    return {
      status: "unknown",
      moduleId,
      dependsOn: [],
      timestamp: now(),
    };
  }

  return {
    status: "loaded",
    moduleId,
    dependsOn: module.dependsOn,
    timestamp: now(),
  };
}

export function getProjectRiskSummary() {
  const summary = PROJECT_MODULES.reduce(
    (acc, module) => {
      acc[module.risk] = (acc[module.risk] || 0) + 1;
      return acc;
    },
    {} as Record<ProjectModuleRisk, number>
  );

  return {
    summary,
    highRiskFiles: HIGH_RISK_FILES,
    criticalFiles: CRITICAL_FILES,
    timestamp: now(),
  };
}

export const projectModules = PROJECT_MODULES;

export const projectMap = getProjectMap();

export const getProjectFilesFromMap = getProjectFiles;

export const findProjectModule = getProjectModuleById;

export const findProjectModuleByFile = getProjectModuleForFile;

export const analyzeProjectMapFile = analyzeProjectFile;

export default getProjectMap;