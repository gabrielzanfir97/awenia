import { runBackgroundWorker } from "./background-worker";
import { analyzeError } from "./self-debug";
import { createTaskPlan } from "./task-planner";
import { runOmniscientCognition } from "./omniscient-cognition";
import { runAutonomousTests } from "./autonomous-testing";

import {
  buildProjectState,
  getSafeProjectStatusForReply,
} from "./project-state";

import {
  checkInternetConnection,
  getInternetState,
} from "./internet";

import {
  checkSupabaseHealth,
  checkSupabaseTables,
  getSupabaseState,
} from "./supabase";

import {
  getMemoryStoreState,
  checkMemoryStoreHealth,
} from "./memory-store";

import {
  getProjectMap,
  getProjectRiskSummary,
} from "./project-map";

export type SystemToolStatus =
  | "completed"
  | "failed"
  | "blocked"
  | "not_found";

export type SystemToolResult = {
  status: SystemToolStatus;
  tool: string;
  verified: boolean;
  result: any;
  error?: string;
  truthPolicy: {
    noFakeToolResult: boolean;
    noFakeBuildStatus: boolean;
    noFakeInternetStatus: boolean;
    noFakeMemoryStatus: boolean;
    verifiedMeansToolActuallyRan: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function safeStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractAfterPrefix(message: string, prefix: string) {
  return message.replace(prefix, "").trim();
}

function createResult(
  tool: string,
  result: any,
  status: SystemToolStatus = "completed",
  verified = true
): SystemToolResult {
  return {
    status,
    tool,
    verified,
    result,
    truthPolicy: {
      noFakeToolResult: true,
      noFakeBuildStatus: true,
      noFakeInternetStatus: true,
      noFakeMemoryStatus: true,
      verifiedMeansToolActuallyRan: verified,
    },
    timestamp: now(),
  };
}

function createErrorResult(
  tool: string,
  error: any
): SystemToolResult {
  return {
    status: "failed",
    tool,
    verified: false,
    result: null,
    error: error?.message || "Unknown system tool error",
    truthPolicy: {
      noFakeToolResult: true,
      noFakeBuildStatus: true,
      noFakeInternetStatus: true,
      noFakeMemoryStatus: true,
      verifiedMeansToolActuallyRan: false,
    },
    timestamp: now(),
  };
}

function jsonResponse(result: SystemToolResult) {
  return Response.json({
    reply: safeStringify(result.result),
    tool: result.tool,
    status: result.status,
    verified: result.verified,
    result,
  });
}

export async function handleRunBackgroundWorker() {
  try {
    const result = await runBackgroundWorker();

    return jsonResponse(
      createResult("RUN_BACKGROUND_WORKER", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("RUN_BACKGROUND_WORKER", error)
    );
  }
}

export async function handleDebugError(message: string) {
  try {
    const errorText = extractAfterPrefix(message, "DEBUG_ERROR:");

    const result = analyzeError(errorText);

    return jsonResponse(
      createResult("DEBUG_ERROR", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("DEBUG_ERROR", error)
    );
  }
}

export async function handleTaskPlan(message: string) {
  try {
    const task = extractAfterPrefix(message, "TASK_PLAN:");

    const result = await createTaskPlan(task);

    return jsonResponse(
      createResult("TASK_PLAN", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("TASK_PLAN", error)
    );
  }
}

export async function handleAweniaStatus() {
  try {
    const safeStatus = await getSafeProjectStatusForReply();

    const projectState = await buildProjectState({
      checkInternet: false,
      runTests: false,
    });

    const memoryHealth = await checkMemoryStoreHealth();

    const result = {
      status: "verified_status_loaded",

      safeStatus,

      projectState: {
        status: projectState.status,
        project: projectState.project,
        verified: projectState.verified,
        notVerified: projectState.notVerified,
        summary: projectState.summary,
      },

      memoryHealth,

      importantWarning:
        "Acest status nu confirmă build-ul, existența fișierelor pe disk sau serverul local. Pentru asta trebuie rulate verificări separate.",

      timestamp: now(),
    };

    return jsonResponse(
      createResult("CHECK_AWENIA_STATUS", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("CHECK_AWENIA_STATUS", error)
    );
  }
}

export async function handleRunAutonomousTests() {
  try {
    const result = await runAutonomousTests();

    return jsonResponse(
      createResult("RUN_AUTONOMOUS_TESTS", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("RUN_AUTONOMOUS_TESTS", error)
    );
  }
}

export async function handleCheckInternetSystem() {
  try {
    const connection = await checkInternetConnection();
    const state = await getInternetState();

    const result = {
      connection,
      state,
      verified: true,
      warning:
        "Internetul este considerat conectat doar dacă fetch-ul real a reușit.",
      timestamp: now(),
    };

    return jsonResponse(
      createResult("CHECK_INTERNET_SYSTEM", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("CHECK_INTERNET_SYSTEM", error)
    );
  }
}

export async function handleCheckSupabaseSystem() {
  try {
    const state = getSupabaseState();
    const health = await checkSupabaseHealth("memories");
    const tables = await checkSupabaseTables([
      "memories",
      "memory_summaries",
      "autonomous_goals",
      "evolution_suggestions",
      "personality_traits",
      "learning_tasks",
      "pending_actions",
      "project_code_memory",
    ]);

    const result = {
      state,
      health,
      tables,
      verified: true,
      warning:
        "Env prezent nu înseamnă conexiune. Conexiunea este verificată doar prin query.",
      timestamp: now(),
    };

    return jsonResponse(
      createResult("CHECK_SUPABASE_SYSTEM", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("CHECK_SUPABASE_SYSTEM", error)
    );
  }
}

export async function handleCheckMemorySystem() {
  try {
    const state = getMemoryStoreState();
    const health = await checkMemoryStoreHealth();

    const result = {
      state,
      health,
      verified: true,
      warning:
        "Runtime memory nu este același lucru cu memoria Supabase.",
      timestamp: now(),
    };

    return jsonResponse(
      createResult("CHECK_MEMORY_SYSTEM", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("CHECK_MEMORY_SYSTEM", error)
    );
  }
}

export async function handleProjectState() {
  try {
    const result = await buildProjectState({
      checkInternet: false,
      runTests: true,
    });

    return jsonResponse(
      createResult("CHECK_PROJECT_STATE", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("CHECK_PROJECT_STATE", error)
    );
  }
}

export async function handleProjectMap() {
  try {
    const result = {
      map: getProjectMap(),
      riskSummary: getProjectRiskSummary(),
      warning:
        "Project map este arhitectură declarată. Nu confirmă singură existența fișierelor pe disk.",
      timestamp: now(),
    };

    return jsonResponse(
      createResult("CHECK_PROJECT_MAP", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("CHECK_PROJECT_MAP", error)
    );
  }
}

export async function handleOmniscientCognition() {
  try {
    const result = await runOmniscientCognition();

    return jsonResponse(
      createResult("RUN_OMNISCIENT_COGNITION", result)
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("RUN_OMNISCIENT_COGNITION", error)
    );
  }
}

export async function handleSystemToolCommand(message: string) {
  const clean = message.trim();
  const upper = clean.toUpperCase();

  if (upper.startsWith("RUN_BACKGROUND_WORKER")) {
    return handleRunBackgroundWorker();
  }

  if (upper.startsWith("DEBUG_ERROR:")) {
    return handleDebugError(clean);
  }

  if (upper.startsWith("TASK_PLAN:")) {
    return handleTaskPlan(clean);
  }

  if (upper.startsWith("CHECK_AWENIA_STATUS")) {
    return handleAweniaStatus();
  }

  if (upper.startsWith("RUN_AUTONOMOUS_TESTS")) {
    return handleRunAutonomousTests();
  }

  if (upper.startsWith("CHECK_INTERNET_SYSTEM")) {
    return handleCheckInternetSystem();
  }

  if (upper.startsWith("CHECK_SUPABASE_SYSTEM")) {
    return handleCheckSupabaseSystem();
  }

  if (upper.startsWith("CHECK_MEMORY_SYSTEM")) {
    return handleCheckMemorySystem();
  }

  if (upper.startsWith("CHECK_PROJECT_STATE")) {
    return handleProjectState();
  }

  if (upper.startsWith("CHECK_PROJECT_MAP")) {
    return handleProjectMap();
  }

  if (upper.startsWith("RUN_OMNISCIENT_COGNITION")) {
    return handleOmniscientCognition();
  }

  return jsonResponse({
    status: "not_found",
    tool: "UNKNOWN_SYSTEM_TOOL",
    verified: true,
    result: {
      message: "Comanda system tool nu este recunoscută.",
      received: clean,
      availableCommands: [
        "RUN_BACKGROUND_WORKER",
        "DEBUG_ERROR:",
        "TASK_PLAN:",
        "CHECK_AWENIA_STATUS",
        "RUN_AUTONOMOUS_TESTS",
        "CHECK_INTERNET_SYSTEM",
        "CHECK_SUPABASE_SYSTEM",
        "CHECK_MEMORY_SYSTEM",
        "CHECK_PROJECT_STATE",
        "CHECK_PROJECT_MAP",
        "RUN_OMNISCIENT_COGNITION",
      ],
    },
    truthPolicy: {
      noFakeToolResult: true,
      noFakeBuildStatus: true,
      noFakeInternetStatus: true,
      noFakeMemoryStatus: true,
      verifiedMeansToolActuallyRan: true,
    },
    timestamp: now(),
  });
}

export function isSystemToolCommand(message: string) {
  const upper = message.trim().toUpperCase();

  return (
    upper.startsWith("RUN_BACKGROUND_WORKER") ||
    upper.startsWith("DEBUG_ERROR:") ||
    upper.startsWith("TASK_PLAN:") ||
    upper.startsWith("CHECK_AWENIA_STATUS") ||
    upper.startsWith("RUN_AUTONOMOUS_TESTS") ||
    upper.startsWith("CHECK_INTERNET_SYSTEM") ||
    upper.startsWith("CHECK_SUPABASE_SYSTEM") ||
    upper.startsWith("CHECK_MEMORY_SYSTEM") ||
    upper.startsWith("CHECK_PROJECT_STATE") ||
    upper.startsWith("CHECK_PROJECT_MAP") ||
    upper.startsWith("RUN_OMNISCIENT_COGNITION")
  );
}

export const handleAweniaSystemStatus = handleAweniaStatus;
export const handleAutonomousTests = handleRunAutonomousTests;
export const handleInternetSystem = handleCheckInternetSystem;
export const handleSupabaseSystem = handleCheckSupabaseSystem;
export const handleMemorySystem = handleCheckMemorySystem;
export const handleSystemCommand = handleSystemToolCommand;

export default handleSystemToolCommand;