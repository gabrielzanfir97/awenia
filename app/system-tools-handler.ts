import { runBackgroundWorker } from "./background-worker";
import { prepareDebuggerAnalysis } from "./agent-orchestrator";
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

    const agentResult = await prepareDebuggerAnalysis(errorText);
    if (agentResult.status !== "analyzed" || !agentResult.analysis) {
      return jsonResponse(createErrorResult(
        "DEBUG_ERROR", new Error(agentResult.error || "Debugger analysis failed.")
      ));
    }

    return jsonResponse(createResult("DEBUG_ERROR", agentResult.analysis));
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

export async function handleCheckVirtualComputer() {
  try {
    const baseUrl = "http://127.0.0.1:38472";

    const [healthResponse, componentsResponse] = await Promise.all([
      fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }),
      fetch(`${baseUrl}/components`, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }),
    ]);

    if (!healthResponse.ok || !componentsResponse.ok) {
      throw new Error("Virtual Computer V4 HTTP connection failed");
    }

    const health = await healthResponse.json();
    const components = await componentsResponse.json();

    if (
      health?.status !== "ready" ||
      health?.service !== "awenia_virtual_computer_v4" ||
      components?.status !== "completed" ||
      !components?.components
    ) {
      throw new Error("Virtual Computer V4 returned invalid data");
    }

    return jsonResponse(
      createResult("CHECK_VIRTUAL_COMPUTER", {
        connected: true,
        health,
        components: components.components,
        warning: "Connection verified; individual components may still be inactive.",
        timestamp: now(),
      })
    );
  } catch (error: any) {
    return jsonResponse(
      createErrorResult("CHECK_VIRTUAL_COMPUTER", error)
    );
  }
}

function isValidVirtualRamWriteInput(value: any): value is {
  key: string;
  bytes: number[];
} {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.key === "string" &&
    /^[A-Za-z0-9._-]{1,128}$/.test(value.key) &&
    Array.isArray(value.bytes) &&
    value.bytes.length >= 1 &&
    value.bytes.length <= 4096 &&
    value.bytes.every(
      (n: unknown) =>
        typeof n === "number" &&
        Number.isInteger(n) &&
        n >= 0 &&
        n <= 255
    )
  );
}

export async function handleRequestVirtualRamWrite(message: string) {
  const tool = "VIRTUAL_RAM_WRITE_REQUEST";

  try {
    const raw = message
      .trim()
      .slice("VIRTUAL_RAM_WRITE_REQUEST:".length)
      .trim();

    if (!raw || raw.length > 24000) {
      throw new Error("Invalid RAM write request size");
    }

    const input = JSON.parse(raw);

    if (!isValidVirtualRamWriteInput(input)) {
      throw new Error("Invalid RAM write payload");
    }

    const { savePendingAction } = await import("./pending-actions");

    const action = await savePendingAction({
      action_type: "OTHER",
      source: "virtual_ram_write",
      reason: "Gabi approval required for Virtual RAM write",
      risk: "high",
      requires_approval: true,
      metadata: {
        operation: "ram.write",
        key: input.key,
        bytes: input.bytes,
      },
    });

    if (
      action?.status !== "pending" ||
      action?.requires_approval !== true
    ) {
      throw new Error("RAM write approval request was not queued");
    }

    return jsonResponse(
      createResult(tool, {
        status: "pending_approval",
        pendingActionId: action.id,
        key: input.key,
        byteCount: input.bytes.length,
        noMemoryChanged: true,
      })
    );
  } catch (error: any) {
    return jsonResponse(createErrorResult(tool, error));
  }
}

export async function handleRunVirtualComputer(message: string) {
  const tool = "VIRTUAL_COMPUTER_RUN";

  try {
    const raw = message.slice("VIRTUAL_COMPUTER_RUN:".length).trim();

    if (!raw || raw.length > 16000) {
      throw new Error("Invalid request size");
    }

    const input = JSON.parse(raw);

    if (input?.channel === "io.text") {
      const text = input?.payload?.text;

      if (
        typeof text !== "string" ||
        !text.trim() ||
        text.length > 2000
      ) {
        throw new Error("Invalid IO text");
      }

      const response = await fetch("http://127.0.0.1:38472/io/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Virtual IO HTTP ${response.status}`);
      }

      const data = await response.json();

      if (
        data?.status === "failed" ||
        data?.status === "blocked"
      ) {
        throw new Error(data?.error || "Virtual IO failed");
      }

      return jsonResponse(
        createResult(tool, {
          channel: "io.text",
          execution: data,
          timestamp: now(),
        })
      );
    }

    const allowedChannels = [
      "cpu.run",
      "gpu.run",
      "ram.read",
      "ssd.get",
      "network.health",
    ];

    if (!allowedChannels.includes(input?.channel)) {
      throw new Error("Channel not allowed");
    }

    if (
      input.channel === "gpu.run" &&
      !["capabilities", "integerSum"].includes(input?.payload?.request?.op)
    ) {
      throw new Error("GPU operation not allowed");
    }

    const response = await fetch("http://127.0.0.1:38472/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: input.channel,
        payload: input.payload ?? {},
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Virtual Computer HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data?.status !== "completed") {
      throw new Error(data?.error || "Virtual computer execution failed");
    }

    return jsonResponse(
      createResult(tool, {
        channel: input.channel,
        execution: data,
        timestamp: now(),
      })
    );
  } catch (error: any) {
    return jsonResponse(createErrorResult(tool, error));
  }
}

export async function handleCoderProposal(message: string) {
  const tool = "CODER_PROPOSAL";

  try {
    const raw = message.slice("CODER_PROPOSAL:".length).trim();

    if (!raw || raw.length > 8000) {
      throw new Error("Invalid coder request size");
    }

    const input = JSON.parse(raw);

    if (
      typeof input?.filePath !== "string" ||
      typeof input?.task !== "string" ||
      !input.filePath.trim() ||
      !input.task.trim() ||
      input.filePath.length > 250 ||
      input.task.length > 4000
    ) {
      throw new Error("Valid filePath and task are required");
    }

    const { prepareCoderProposal } = await import("./agent-orchestrator");

    const result = await prepareCoderProposal(
      input.filePath,
      input.task
    );

    if (
      result.status !== "ready_for_review" ||
      !result.proposal ||
      result.fileChanged !== false ||
      result.requiresApproval !== true
    ) {
      throw new Error(result.error || "Coder proposal failed");
    }

    return jsonResponse(
      createResult(tool, {
        status: "ready_for_review",
        proposal: result.proposal,
        fileChanged: false,
        requiresApproval: true,
        timestamp: now(),
      })
    );
  } catch (error: any) {
    return jsonResponse(createErrorResult(tool, error));
  }
}

export async function handleAgentWorkflow(message: string) {
  const tool = "RUN_AGENT_WORKFLOW";

  try {
    const clean = message.trim();
    const raw = clean.slice("RUN_AGENT_WORKFLOW:".length).trim();

    if (!raw || raw.length > 5000) {
      throw new Error("Invalid agent workflow request size");
    }

    const input = JSON.parse(raw);

    const allowedTypes = [
      "planning",
      "coding",
      "debug",
      "memory",
      "research",
      "goal",
      "monitor",
    ];

    if (
      typeof input?.taskType !== "string" ||
      typeof input?.taskDetail !== "string" ||
      !allowedTypes.includes(input.taskType.trim().toLowerCase()) ||
      !input.taskDetail.trim() ||
      input.taskDetail.length > 4000
    ) {
      throw new Error("Invalid agent workflow task");
    }

    const { executeAgentWorkflow } = await import(
      "./agent-orchestrator"
    );

    const result = await executeAgentWorkflow(
      input.taskType.trim().toLowerCase(),
      input.taskDetail.trim()
    );

    return jsonResponse(
      createResult(
        tool,
        result,
        result.status === "completed" ||
        result.status === "ready_for_review"
          ? "completed"
          : "failed"
      )
    );
  } catch (error: any) {
    return jsonResponse(createErrorResult(tool, error));
  }
}

const executingVirtualRamWrites = new Set<string>();

export async function handleExecuteVirtualRamWrite(message: string) {
  const tool = "EXECUTE_VIRTUAL_RAM_WRITE";
  const id = message.trim().slice("EXECUTE_VIRTUAL_RAM_WRITE:".length).trim();

  try {
    if (!/^[1-9][0-9]{0,17}$/.test(id)) {
      throw new Error("Invalid pending action ID");
    }

    if (executingVirtualRamWrites.has(id)) {
      throw new Error("RAM write action is already executing");
    }

    executingVirtualRamWrites.add(id);

    try {
      const {
        getPendingActionById,
        canExecutePendingAction,
        completePendingAction,
      } = await import("./pending-actions");

      const action = await getPendingActionById(id);
      const approval = canExecutePendingAction(action);

      if (
        !approval.allowed ||
        action?.status !== "approved" ||
        action?.action_type !== "OTHER" ||
        action?.source !== "virtual_ram_write" ||
        action?.risk !== "high" ||
        action?.requires_approval !== true ||
        action?.approved_by !== "Gabi" ||
        !action?.approved_at ||
        action?.metadata?.operation !== "ram.write"
      ) {
        throw new Error("RAM write requires a valid Gabi-approved action");
      }

      const payload = {
        key: action.metadata.key,
        bytes: action.metadata.bytes,
      };

      if (!isValidVirtualRamWriteInput(payload)) {
        throw new Error("Approved RAM write payload is invalid");
      }

      const token = process.env.AWENIA_V4_WRITE_TOKEN;

      if (!token || token.length < 32) {
        throw new Error("Virtual RAM write token is not configured");
      }

      const response = await fetch("http://127.0.0.1:38472/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-awenia-v4-write-token": token,
        },
        body: JSON.stringify({ channel: "ram.write", payload }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });

      const data = await response.json();

      if (
        !response.ok ||
        data?.status !== "completed" ||
        data?.channel !== "ram.write"
      ) {
        throw new Error(data?.error || "Virtual RAM write failed");
      }

      try {
        await completePendingAction(id);
      } catch {
        throw new Error("RAM write succeeded, but action completion failed. Do not retry automatically.");
      }

      return jsonResponse(createResult(tool, {
        status: "completed",
        pendingActionId: id,
        channel: "ram.write",
        key: payload.key,
        byteCount: payload.bytes.length,
        execution: data,
        timestamp: now(),
      }));
    } finally {
      executingVirtualRamWrites.delete(id);
    }
  } catch (error: any) {
    return jsonResponse(createErrorResult(tool, error));
  }
}

function isValidVirtualSsdPutInput(value: any): value is {
  key: string;
  bytes: number[];
} {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.key === "string" &&
    /^[A-Za-z0-9_-]{1,80}$/.test(value.key) &&
    Array.isArray(value.bytes) &&
    value.bytes.length >= 1 &&
    value.bytes.length <= 4096 &&
    value.bytes.every(
      (n: unknown) =>
        typeof n === "number" &&
        Number.isInteger(n) &&
        n >= 0 &&
        n <= 255
    )
  );
}

export async function handleRequestVirtualSsdPut(message: string) {
  const tool = "VIRTUAL_SSD_PUT_REQUEST";

  try {
    const raw = message.trim().slice("VIRTUAL_SSD_PUT_REQUEST:".length).trim();
    if (!raw || raw.length > 24000) {
      throw new Error("Invalid SSD write request size");
    }

    const input = JSON.parse(raw);
    if (!isValidVirtualSsdPutInput(input)) {
      throw new Error("Invalid SSD key or bytes");
    }

    const { savePendingAction } = await import("./pending-actions");
    const action = await savePendingAction({
      action_type: "OTHER",
      source: "virtual_ssd_put",
      reason: "Gabi approval required for Virtual SSD write",
      risk: "high",
      requires_approval: true,
      metadata: {
        operation: "ssd.put",
        key: input.key,
        bytes: input.bytes,
      },
    });

    if (action?.status !== "pending" || action?.requires_approval !== true) {
      throw new Error("SSD write approval request was not queued");
    }

    return jsonResponse(createResult(tool, {
      status: "pending_approval",
      pendingActionId: action.id,
      key: input.key,
      byteCount: input.bytes.length,
      noSsdChanged: true,
    }));
  } catch (error: any) {
    return jsonResponse(createErrorResult(tool, error));
  }
}

const executingVirtualSsdPuts = new Set<string>();

export async function handleExecuteVirtualSsdPut(message: string) {
  const tool = "EXECUTE_VIRTUAL_SSD_PUT";
  const id = message.trim().slice("EXECUTE_VIRTUAL_SSD_PUT:".length).trim();

  try {
    if (!/^[1-9][0-9]{0,17}$/.test(id)) {
      throw new Error("Invalid pending action ID");
    }
    if (executingVirtualSsdPuts.has(id)) {
      throw new Error("SSD write action is already executing");
    }

    executingVirtualSsdPuts.add(id);
    try {
      const {
        getPendingActionById,
        canExecutePendingAction,
        completePendingAction,
      } = await import("./pending-actions");

      const action = await getPendingActionById(id);
      const approval = canExecutePendingAction(action);
      if (
        !approval.allowed ||
        action?.status !== "approved" ||
        action?.action_type !== "OTHER" ||
        action?.source !== "virtual_ssd_put" ||
        action?.risk !== "high" ||
        action?.requires_approval !== true ||
        action?.approved_by !== "Gabi" ||
        !action?.approved_at ||
        action?.metadata?.operation !== "ssd.put"
      ) {
        throw new Error("SSD write requires a valid Gabi-approved action");
      }

      const payload = {
        key: action.metadata.key,
        bytes: action.metadata.bytes,
      };
      if (!isValidVirtualSsdPutInput(payload)) {
        throw new Error("Approved SSD payload is invalid");
      }

      const token = process.env.AWENIA_V4_WRITE_TOKEN;
      if (!token || token.length < 32) {
        throw new Error("Virtual SSD write token is not configured");
      }

      const response = await fetch("http://127.0.0.1:38472/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-awenia-v4-write-token": token,
        },
        body: JSON.stringify({ channel: "ssd.put", payload }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      const data = await response.json();
      if (
        !response.ok ||
        data?.status !== "completed" ||
        data?.channel !== "ssd.put" ||
        data?.result !== payload.bytes.length
      ) {
        throw new Error(data?.error || "Virtual SSD write failed; verify before retry");
      }

      try {
        await completePendingAction(id);
      } catch {
        throw new Error("SSD write succeeded, but action completion failed. Do not retry automatically.");
      }

      return jsonResponse(createResult(tool, {
        status: "completed",
        pendingActionId: id,
        channel: "ssd.put",
        key: payload.key,
        byteCount: payload.bytes.length,
        execution: data,
        timestamp: now(),
      }));
    } finally {
      executingVirtualSsdPuts.delete(id);
    }
  } catch (error: any) {
    return jsonResponse(createErrorResult(tool, error));
  }
}

export async function handleSystemToolCommand(message: string) {
  const ramCommand = message.trim().toUpperCase();

  if (ramCommand.startsWith("VIRTUAL_SSD_PUT_REQUEST:")) {
    return handleRequestVirtualSsdPut(message);
  }

  if (ramCommand.startsWith("EXECUTE_VIRTUAL_SSD_PUT:")) {
    return handleExecuteVirtualSsdPut(message);
  }

  if (ramCommand.startsWith("VIRTUAL_RAM_WRITE_REQUEST:")) {
    return handleRequestVirtualRamWrite(message);
  }

  if (ramCommand.startsWith("EXECUTE_VIRTUAL_RAM_WRITE:")) {
    return handleExecuteVirtualRamWrite(message);
  }
  if (message.trim().toUpperCase().startsWith("RUN_AGENT_WORKFLOW:")) {
    return handleAgentWorkflow(message);
  }
  if (message.trim().toUpperCase().startsWith("CODER_PROPOSAL:")) {
    return handleCoderProposal(message);
  }
  if (message.trim().toUpperCase().startsWith("VIRTUAL_COMPUTER_RUN:")) {
    return handleRunVirtualComputer(message);
  }
  if (String(message || "").trim().toUpperCase() === "CHECK_VIRTUAL_COMPUTER") {
    return handleCheckVirtualComputer();
  }
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
    upper.startsWith("VIRTUAL_RAM_WRITE_REQUEST:") ||
    upper.startsWith("EXECUTE_VIRTUAL_RAM_WRITE:") ||
    upper.startsWith("VIRTUAL_SSD_PUT_REQUEST:") ||
    upper.startsWith("EXECUTE_VIRTUAL_SSD_PUT:") ||
    upper === "CHECK_VIRTUAL_COMPUTER" ||
    upper.startsWith("VIRTUAL_COMPUTER_RUN:") ||
    upper.startsWith("CODER_PROPOSAL:") ||
    upper.startsWith("RUN_AGENT_WORKFLOW:") ||
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