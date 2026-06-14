import {
  getProjectMap,
  getProjectRiskSummary,
  getProjectFiles,
  buildProjectMapContext,
} from "./project-map";

import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { runAutonomousTests } from "./autonomous-testing";

import {
  getSupabaseState,
  checkSupabaseHealth,
  checkSupabaseTables,
} from "./supabase";

import {
  getMemoryStoreState,
  checkMemoryStoreHealth,
} from "./memory-store";

import { getCodeMemoryState } from "./code-memory";
import { checkInternetConnection } from "./internet";

export type ProjectStateStatus =
  | "loaded"
  | "verified"
  | "partial"
  | "needs_attention"
  | "failed";

export type VerificationStatus =
  | "verified"
  | "not_checked"
  | "estimated"
  | "failed";

export type ProjectStateSource = {
  name: string;
  status: VerificationStatus;
  data: any;
  error?: string;
};

export type AweniaProjectState = {
  status: ProjectStateStatus;
  project: {
    name: "Awenia";
    owner: "Gabi";
    localPath: string;
    framework: "Next.js";
    language: "TypeScript";
    mode: "local_personal_ai";
  };
  verified: {
    architectureMap: boolean;
    memoryStore: boolean;
    supabaseConfig: boolean;
    supabaseConnection: boolean;
    awareness: boolean;
    longTermMemory: boolean;
    goals: boolean;
    codeMemory: boolean;
    autonomousTests: boolean;
    internet?: boolean;
  };
  notVerified: {
    filesystemExists: boolean;
    buildPassed: boolean;
    appRunning: boolean;
    routeCompiled: boolean;
    browserTested: boolean;
  };
  summary: {
    totalMappedFiles: number;
    totalMappedModules: number;
    highRiskFiles: string[];
    criticalFiles: string[];
    currentMainRisk: string;
    nextRecommendedAction: string;
  };
  sources: ProjectStateSource[];
  map: any;
  riskSummary: any;
  context: string;
  truthPolicy: {
    projectMapDoesNotConfirmFilesExist: boolean;
    buildStatusRequiresNpmBuild: boolean;
    runtimeStatusRequiresServerCheck: boolean;
    databaseStatusRequiresSupabaseQuery: boolean;
    internetStatusRequiresFetch: boolean;
    noFakeProjectStatus: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function safeError(error: any) {
  return error?.message || "Unknown project-state error";
}

async function safeSource(
  name: string,
  loader: () => Promise<any> | any,
  verified = true
): Promise<ProjectStateSource> {
  try {
    const data = await loader();

    return {
      name,
      status: verified ? "verified" : "estimated",
      data,
    };
  } catch (error: any) {
    return {
      name,
      status: "failed",
      data: null,
      error: safeError(error),
    };
  }
}

function sourceOk(source: ProjectStateSource) {
  return source.status === "verified" || source.status === "estimated";
}

function findSource(sources: ProjectStateSource[], name: string) {
  return sources.find((source) => source.name === name) || null;
}

function buildMainRisk(input: {
  failedSources: ProjectStateSource[];
  highRiskFiles: string[];
  criticalFiles: string[];
}) {
  if (input.failedSources.length > 0) {
    return `Surse eșuate: ${input.failedSources
      .map((source) => source.name)
      .join(", ")}`;
  }

  if (input.criticalFiles.length > 0) {
    return "Există fișiere critice în arhitectura declarată. Nu se modifică fără aprobare.";
  }

  if (input.highRiskFiles.length > 0) {
    return "Există fișiere high-risk. Orice modificare trebuie verificată.";
  }

  return "Nu există risc critic detectat în harta declarată.";
}

function buildNextAction(input: {
  failedSources: ProjectStateSource[];
  includeInternet: boolean;
}) {
  if (input.failedSources.length > 0) {
    return "Verifică sursele eșuate înainte de modificări noi.";
  }

  if (!input.includeInternet) {
    return "Continuă auditul fișierelor. Build-ul se rulează doar la final, când Gabi spune.";
  }

  return "Continuă cu următorul fișier sau rulează testele cerute de Gabi.";
}

function buildContext(input: {
  mapContext: string;
  sources: ProjectStateSource[];
  notVerified: AweniaProjectState["notVerified"];
}) {
  const sourceLines = input.sources.map((source) => {
    return `- ${source.name}: ${source.status}${source.error ? ` (${source.error})` : ""
      }`;
  });

  const notVerifiedLines = Object.entries(input.notVerified).map(
    ([key, value]) => `- ${key}: ${value ? "verified" : "not_checked"}`
  );

  return [
    "PROJECT STATE AWENIA",
    "",
    "Surse citite/verificate:",
    sourceLines.join("\n"),
    "",
    "Lucruri NU verificate de project-state.ts:",
    notVerifiedLines.join("\n"),
    "",
    "Hartă proiect:",
    input.mapContext,
  ].join("\n");
}

export async function buildProjectState(options?: {
  checkInternet?: boolean;
  runTests?: boolean;
}) {
  const startedAt = now();

  const includeInternet = options?.checkInternet ?? false;
  const includeTests = options?.runTests ?? true;

  const map = getProjectMap();
  const projectFiles = getProjectFiles();
  const riskSummary = getProjectRiskSummary();

  const sources: ProjectStateSource[] = [];

  sources.push({
    name: "project_map",
    status: "verified",
    data: map,
  });

  sources.push({
    name: "project_risk_summary",
    status: "verified",
    data: riskSummary,
  });

  sources.push({
    name: "supabase_state",
    status: "estimated",
    data: getSupabaseState(),
  });

  sources.push(
    await safeSource("supabase_health", () =>
      checkSupabaseHealth("memories")
    )
  );

  sources.push(
    await safeSource("supabase_tables", () =>
      checkSupabaseTables([
        "memories",
        "memory_summaries",
        "autonomous_goals",
        "evolution_suggestions",
        "personality_traits",
        "learning_tasks",
      ])
    )
  );

  sources.push({
    name: "memory_store_state",
    status: "estimated",
    data: getMemoryStoreState(),
  });

  sources.push(
    await safeSource("memory_store_health", () =>
      checkMemoryStoreHealth()
    )
  );

  sources.push({
    name: "code_memory_state",
    status: "estimated",
    data: getCodeMemoryState(),
  });

  sources.push(
    await safeSource("awareness", () => buildAwarenessState())
  );

  sources.push(
    await safeSource("long_term_memory", () => buildLongTermMemory())
  );

  sources.push(
    await safeSource("goals", () => manageAutonomousGoals())
  );

  if (includeTests) {
    sources.push(
      await safeSource("autonomous_tests", () => runAutonomousTests())
    );
  } else {
    sources.push({
      name: "autonomous_tests",
      status: "not_checked",
      data: {
        reason: "Autonomous tests were skipped by option.",
      },
    });
  }

  if (includeInternet) {
    sources.push(
      await safeSource("internet_connection", () =>
        checkInternetConnection()
      )
    );
  } else {
    sources.push({
      name: "internet_connection",
      status: "not_checked",
      data: {
        reason:
          "Internet was not checked because project-state does not check it by default.",
      },
    });
  }

  const failedSources = sources.filter(
    (source) => source.status === "failed"
  );

  const supabaseHealth = findSource(sources, "supabase_health");
  const awareness = findSource(sources, "awareness");
  const longTermMemory = findSource(sources, "long_term_memory");
  const goals = findSource(sources, "goals");
  const autonomousTests = findSource(sources, "autonomous_tests");
  const internet = findSource(sources, "internet_connection");

  const notVerified = {
    filesystemExists: false,
    buildPassed: false,
    appRunning: false,
    routeCompiled: false,
    browserTested: false,
  };

  const status: ProjectStateStatus =
    failedSources.length > 0
      ? "partial"
      : includeTests && autonomousTests?.status === "verified"
        ? "verified"
        : "loaded";

  const state: AweniaProjectState = {
    status,

    project: {
      name: "Awenia",
      owner: "Gabi",
      localPath: "C:\\Users\\gabri\\awenia",
      framework: "Next.js",
      language: "TypeScript",
      mode: "local_personal_ai",
    },

    verified: {
      architectureMap: true,
      memoryStore: true,
      supabaseConfig: true,
      supabaseConnection:
        supabaseHealth?.data?.connected === true ||
        supabaseHealth?.data?.status === "connected",
      awareness: sourceOk(awareness as ProjectStateSource),
      longTermMemory: sourceOk(longTermMemory as ProjectStateSource),
      goals: sourceOk(goals as ProjectStateSource),
      codeMemory: true,
      autonomousTests:
        autonomousTests?.status === "verified",
      internet:
        internet?.data?.connected === true ||
        internet?.data?.status === "connected",
    },

    notVerified,

    summary: {
      totalMappedFiles: projectFiles.length,
      totalMappedModules: map.totalModules,
      highRiskFiles: riskSummary.highRiskFiles,
      criticalFiles: riskSummary.criticalFiles,
      currentMainRisk: buildMainRisk({
        failedSources,
        highRiskFiles: riskSummary.highRiskFiles,
        criticalFiles: riskSummary.criticalFiles,
      }),
      nextRecommendedAction: buildNextAction({
        failedSources,
        includeInternet,
      }),
    },

    sources,

    map,

    riskSummary,

    context: buildContext({
      mapContext: buildProjectMapContext(),
      sources,
      notVerified,
    }),

    truthPolicy: {
      projectMapDoesNotConfirmFilesExist: true,
      buildStatusRequiresNpmBuild: true,
      runtimeStatusRequiresServerCheck: true,
      databaseStatusRequiresSupabaseQuery: true,
      internetStatusRequiresFetch: true,
      noFakeProjectStatus: true,
    },

    timestamp: now(),
  };

  return {
    ...state,
    execution: {
      startedAt,
      completedAt: now(),
    },
  };
}

export async function getProjectState(options?: {
  checkInternet?: boolean;
  runTests?: boolean;
}) {
  return buildProjectState(options);
}

export async function runProjectState(options?: {
  checkInternet?: boolean;
  runTests?: boolean;
}) {
  return buildProjectState(options);
}

export async function checkProjectState() {
  return buildProjectState({
    checkInternet: false,
    runTests: true,
  });
}

export async function checkVerifiedProjectState() {
  return buildProjectState({
    checkInternet: true,
    runTests: true,
  });
}

export async function buildProjectStateContext() {
  const state = await buildProjectState({
    checkInternet: false,
    runTests: false,
  });

  return state.context;
}

export async function getProjectStateSummary() {
  const state = await buildProjectState({
    checkInternet: false,
    runTests: false,
  });

  return {
    status: state.status,
    project: state.project,
    verified: state.verified,
    notVerified: state.notVerified,
    summary: state.summary,
    truthPolicy: state.truthPolicy,
    timestamp: now(),
  };
}

export async function getSafeProjectStatusForReply() {
  const state = await buildProjectState({
    checkInternet: false,
    runTests: false,
  });

  return {
    replySafeStatus: {
      projectMapLoaded: state.verified.architectureMap,
      memoryStoreLoaded: state.verified.memoryStore,
      supabaseConnectionVerified: state.verified.supabaseConnection,
      awarenessLoaded: state.verified.awareness,
      buildPassed: "not_checked",
      filesExistOnDisk: "not_checked",
      appRunning: "not_checked",
      internet: "not_checked",
    },
    warning:
      "Acest status nu confirmă build, existența fișierelor pe disk sau serverul local. Pentru asta trebuie verificări separate.",
    timestamp: now(),
  };
}

export function getProjectStateTruthPolicy() {
  return {
    projectMapDoesNotConfirmFilesExist: true,
    buildStatusRequiresNpmBuild: true,
    runtimeStatusRequiresServerCheck: true,
    databaseStatusRequiresSupabaseQuery: true,
    internetStatusRequiresFetch: true,
    noFakeProjectStatus: true,
    timestamp: now(),
  };
}

export const getAweniaProjectState = getProjectState;
export const buildAweniaProjectState = buildProjectState;
export const runAweniaProjectState = runProjectState;
export const projectState = buildProjectState;

export default buildProjectState;