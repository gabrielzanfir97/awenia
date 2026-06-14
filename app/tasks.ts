import { createTaskPlan } from "./task-planner";

import {
  createLearningTask,
  getLearningTasks,
  createAutonomousReflection,
  createEvolutionSuggestion,
  getAutonomousGoals,
} from "./memory-store";

export type AweniaTaskStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked"
  | "needs_approval";

export type AweniaTaskType =
  | "general"
  | "learning"
  | "memory"
  | "code"
  | "debug"
  | "internet"
  | "goal"
  | "evolution"
  | "security";

export type AweniaTaskRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AweniaTask = {
  id: string;
  title: string;
  description: string;
  type: AweniaTaskType;
  status: AweniaTaskStatus;
  priority: number;
  risk: AweniaTaskRisk;
  requiresApproval: boolean;
  source: "user" | "system" | "autonomous";
  plan?: any;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

const runtimeTasks: AweniaTask[] = [];

function now() {
  return new Date().toISOString();
}

function createId(prefix = "task") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function detectTaskType(text: string): AweniaTaskType {
  const lower = normalize(text);

  if (lower.includes("learn") || lower.includes("învață") || lower.includes("invata")) return "learning";
  if (lower.includes("memory") || lower.includes("memorie")) return "memory";
  if (lower.includes("code") || lower.includes("cod") || lower.includes(".ts")) return "code";
  if (lower.includes("bug") || lower.includes("eroare") || lower.includes("debug")) return "debug";
  if (lower.includes("internet") || lower.includes("online")) return "internet";
  if (lower.includes("goal") || lower.includes("obiectiv") || lower.includes("scop")) return "goal";
  if (lower.includes("evolu") || lower.includes("upgrade") || lower.includes("optimiz")) return "evolution";
  if (lower.includes("security") || lower.includes("siguran") || lower.includes("aprobare")) return "security";

  return "general";
}

function detectRisk(text: string, type: AweniaTaskType): AweniaTaskRisk {
  const lower = normalize(text);

  if (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes(".git") ||
    lower.includes("node_modules") ||
    lower.includes("delete") ||
    lower.includes("șterge") ||
    lower.includes("sterge")
  ) {
    return "critical";
  }

  if (
    lower.includes("route.ts") ||
    lower.includes("memory-store.ts") ||
    lower.includes("supabase.ts") ||
    lower.includes("protected-core.ts") ||
    lower.includes("security.ts")
  ) {
    return "high";
  }

  if (
    type === "code" ||
    type === "debug" ||
    type === "evolution" ||
    type === "security"
  ) {
    return "medium";
  }

  return "low";
}

function detectPriority(text: string, type: AweniaTaskType) {
  const lower = normalize(text);

  let priority = 5;

  if (type === "code") priority += 2;
  if (type === "debug") priority += 2;
  if (type === "evolution") priority += 2;
  if (type === "security") priority += 2;

  if (lower.includes("urgent")) priority += 2;
  if (lower.includes("important")) priority += 2;
  if (lower.includes("awenia")) priority += 2;
  if (lower.includes("build")) priority += 2;

  return Math.max(1, Math.min(10, priority));
}

function requiresApproval(risk: AweniaTaskRisk, type: AweniaTaskType) {
  if (risk === "critical") return true;
  if (risk === "high") return true;
  if (risk === "medium") return true;
  if (type === "code") return true;
  if (type === "evolution") return true;
  if (type === "security") return true;

  return false;
}

function buildTaskTitle(description: string) {
  const clean = description.trim().replace(/\s+/g, " ");

  if (clean.length <= 70) return clean;

  return `${clean.slice(0, 67)}...`;
}

export function analyzeTask(description: string) {
  const type = detectTaskType(description);
  const risk = detectRisk(description, type);
  const priority = detectPriority(description, type);

  return {
    description,
    type,
    risk,
    priority,
    requiresApproval: requiresApproval(risk, type),
    blocked: risk === "critical",
    timestamp: now(),
  };
}

export async function createTask(input: string | Partial<AweniaTask>) {
  const description =
    typeof input === "string"
      ? input
      : input.description || input.title || "";

  const analysis = analyzeTask(description);
  const plan = await createTaskPlan(description);

  const task: AweniaTask = {
    id: typeof input === "string" ? createId() : input.id || createId(),
    title:
      typeof input === "string"
        ? buildTaskTitle(description)
        : input.title || buildTaskTitle(description),
    description,
    type:
      typeof input === "string"
        ? analysis.type
        : input.type || analysis.type,
    status:
      analysis.blocked
        ? "blocked"
        : analysis.requiresApproval
          ? "needs_approval"
          : "pending",
    priority:
      typeof input === "string"
        ? analysis.priority
        : input.priority || analysis.priority,
    risk:
      typeof input === "string"
        ? analysis.risk
        : input.risk || analysis.risk,
    requiresApproval:
      typeof input === "string"
        ? analysis.requiresApproval
        : input.requiresApproval ?? analysis.requiresApproval,
    source:
      typeof input === "string"
        ? "user"
        : input.source || "system",
    plan,
    result: typeof input === "string" ? undefined : input.result,
    error: typeof input === "string" ? undefined : input.error,
    createdAt: now(),
    updatedAt: now(),
    completedAt: undefined,
  };

  runtimeTasks.unshift(task);

  try {
    if (task.type === "learning") {
      await createLearningTask(task.description, task.priority);
    }

    await createAutonomousReflection(
      `Task created: ${task.title}`,
      `Type: ${task.type}. Risk: ${task.risk}. Status: ${task.status}.`,
      task.requiresApproval
        ? "Wait for Gabi approval before execution"
        : "Task can be considered for safe execution"
    );

    if (task.priority >= 8) {
      await createEvolutionSuggestion(
        `High priority task: ${task.title}`,
        `Task created with priority ${task.priority}, type ${task.type}, risk ${task.risk}.`,
        task.priority
      );
    }
  } catch {
    // Task-ul rămâne în runtime chiar dacă memoria nu salvează.
  }

  return task;
}

export async function addTask(input: string | Partial<AweniaTask>) {
  return createTask(input);
}

export function getRuntimeTasks() {
  return runtimeTasks;
}

export async function getTasks(options?: {
  status?: AweniaTaskStatus;
  type?: AweniaTaskType;
  limit?: number;
  includeStoredLearningTasks?: boolean;
}) {
  let tasks = [...runtimeTasks];

  if (options?.status) {
    tasks = tasks.filter((task) => task.status === options.status);
  }

  if (options?.type) {
    tasks = tasks.filter((task) => task.type === options.type);
  }

  const limit = options?.limit || 50;

  const runtime = tasks.slice(0, limit);

  let storedLearningTasks: any[] = [];

  if (options?.includeStoredLearningTasks) {
    try {
      storedLearningTasks = await getLearningTasks(limit);
    } catch {
      storedLearningTasks = [];
    }
  }

  return {
    status: "loaded",
    runtime,
    storedLearningTasks,
    count: runtime.length,
    timestamp: now(),
  };
}

export function getTaskById(taskId: string) {
  return runtimeTasks.find((task) => task.id === taskId) || null;
}

export function updateTask(
  taskId: string,
  updates: Partial<AweniaTask>
) {
  const task = getTaskById(taskId);

  if (!task) {
    return {
      status: "failed",
      updated: false,
      reason: "Task not found",
      taskId,
      timestamp: now(),
    };
  }

  Object.assign(task, {
    ...updates,
    updatedAt: now(),
  });

  return {
    status: "updated",
    updated: true,
    task,
    timestamp: now(),
  };
}

export function startTask(taskId: string) {
  return updateTask(taskId, {
    status: "active",
  });
}

export function completeTask(taskId: string, result?: any) {
  return updateTask(taskId, {
    status: "completed",
    result,
    completedAt: now(),
  });
}

export function failTask(taskId: string, error: string) {
  return updateTask(taskId, {
    status: "failed",
    error,
  });
}

export function cancelTask(taskId: string) {
  return updateTask(taskId, {
    status: "cancelled",
  });
}

export function blockTask(taskId: string, reason: string) {
  return updateTask(taskId, {
    status: "blocked",
    error: reason,
  });
}

export async function getPendingTasks(limit = 50) {
  return getTasks({
    status: "pending",
    limit,
  });
}

export async function getActiveTasks(limit = 50) {
  return getTasks({
    status: "active",
    limit,
  });
}

export async function getCompletedTasks(limit = 50) {
  return getTasks({
    status: "completed",
    limit,
  });
}

export async function getBlockedTasks(limit = 50) {
  return getTasks({
    status: "blocked",
    limit,
  });
}

export async function getTasksNeedingApproval(limit = 50) {
  return getTasks({
    status: "needs_approval",
    limit,
  });
}

export async function buildTaskQueueState() {
  let autonomousGoals: any[] = [];
  let learningTasks: any[] = [];

  try {
    autonomousGoals = await getAutonomousGoals(20);
  } catch {
    autonomousGoals = [];
  }

  try {
    learningTasks = await getLearningTasks(20);
  } catch {
    learningTasks = [];
  }

  const pending = runtimeTasks.filter((task) => task.status === "pending");
  const active = runtimeTasks.filter((task) => task.status === "active");
  const approval = runtimeTasks.filter(
    (task) => task.status === "needs_approval"
  );
  const blocked = runtimeTasks.filter((task) => task.status === "blocked");
  const completed = runtimeTasks.filter(
    (task) => task.status === "completed"
  );

  return {
    status:
      blocked.length > 0
        ? "needs_attention"
        : approval.length > 0
          ? "needs_approval"
          : pending.length > 0 || active.length > 0
            ? "active"
            : "idle",

    runtime: {
      total: runtimeTasks.length,
      pending: pending.length,
      active: active.length,
      needsApproval: approval.length,
      blocked: blocked.length,
      completed: completed.length,
    },

    stored: {
      autonomousGoals: autonomousGoals.length,
      learningTasks: learningTasks.length,
    },

    nextTask:
      active[0] ||
      pending.sort((a, b) => b.priority - a.priority)[0] ||
      approval.sort((a, b) => b.priority - a.priority)[0] ||
      null,

    truthPolicy: {
      noFakeTaskCompletion: true,
      noExecutionWithoutApproval: true,
      persistentTasksMustBeReadFromMemory: true,
    },

    timestamp: now(),
  };
}

export async function runTaskManager() {
  const state = await buildTaskQueueState();

  return {
    status: state.status,
    state,
    recommendation:
      state.status === "needs_approval"
        ? "Așteaptă aprobarea lui Gabi pentru task-urile riscante."
        : state.status === "needs_attention"
          ? "Verifică task-urile blocate."
          : state.status === "active"
            ? "Continuă cu următorul task sigur."
            : "Nu există task-uri active.",
    timestamp: now(),
  };
}

export async function createTaskFromMessage(message: string) {
  return createTask(message);
}

export async function planAndCreateTask(message: string) {
  return createTask(message);
}

export const getTaskQueueState = buildTaskQueueState;
export const runTasks = runTaskManager;
export const taskManager = runTaskManager;