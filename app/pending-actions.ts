import { getSupabaseServer } from "./supabase-server";

const supabase = getSupabaseServer();

export type PendingActionStatus =
  | "pending"
  | "approved"
  | "completed"
  | "rejected"
  | "cancelled"
  | "failed";

export type PendingActionRisk = "low" | "medium" | "high" | "critical";

export type PendingActionType =
  | "WRITE_FILE"
  | "PATCH_FILE"
  | "DELETE_FILE"
  | "ROLLBACK_FILE"
  | "SYSTEM_CHANGE"
  | "EVOLUTION_APPROVAL"
  | "MEMORY_CLEANUP"
  | "OTHER";

export type PendingActionInput = {
  action_type: PendingActionType | string;
  file_path?: string;
  content?: string;
  patch?: string;
  reason?: string;
  source?: string;
  metadata?: any;
  requires_approval?: boolean;
  risk?: PendingActionRisk;
};

export type PendingActionValidation = {
  valid: boolean;
  risk: PendingActionRisk;
  requiresApproval: boolean;
  blocked: boolean;
  reasons: string[];
};

const VALID_ACTION_TYPES = new Set<string>([
  "WRITE_FILE",
  "PATCH_FILE",
  "DELETE_FILE",
  "ROLLBACK_FILE",
  "SYSTEM_CHANGE",
  "EVOLUTION_APPROVAL",
  "MEMORY_CLEANUP",
  "OTHER",
]);

const FILE_ACTION_TYPES = new Set<string>([
  "WRITE_FILE",
  "PATCH_FILE",
  "DELETE_FILE",
  "ROLLBACK_FILE",
]);

const CONTENT_ACTION_TYPES = new Set<string>([
  "WRITE_FILE",
  "PATCH_FILE",
]);

const BLOCKED_PATH_PARTS = [
  ".env",
  ".env.local",
  ".git",
  "node_modules",
  "app/protected-core.ts",
];

const HIGH_RISK_PATH_PARTS = [
  "app/api/",
  "app/supabase.ts",
  "app/memory-store.ts",
  "app/api/awenia/route.ts",
  "app/dev-agent.ts",
  "app/pending-actions.ts",
  "app/security.ts",
  "app/protected-core.ts",
];

function now() {
  return new Date().toISOString();
}

function normalizePath(filePath = "") {
  return filePath
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function normalizeActionType(actionType: PendingActionInput["action_type"]) {
  return String(actionType || "").trim().toUpperCase();
}

function normalizeRisk(risk?: PendingActionRisk) {
  if (
    risk === "low" ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical"
  ) {
    return risk;
  }

  return undefined;
}

function includesPathPart(filePath: string, parts: string[]) {
  const normalized = normalizePath(filePath).toLowerCase();

  return parts.some((part) => {
    const normalizedPart = normalizePath(part).toLowerCase();

    return (
      normalized === normalizedPart ||
      normalized.includes(normalizedPart)
    );
  });
}

function isPathTraversal(filePath: string) {
  const normalized = normalizePath(filePath);

  return (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normalized)
  );
}

function detectActionRisk(input: PendingActionInput): PendingActionRisk {
  const explicitRisk = normalizeRisk(input.risk);

  if (explicitRisk) return explicitRisk;

  const actionType = normalizeActionType(input.action_type);
  const filePath = normalizePath(input.file_path);

  if (!VALID_ACTION_TYPES.has(actionType)) return "high";

  if (isPathTraversal(filePath)) return "critical";

  if (includesPathPart(filePath, BLOCKED_PATH_PARTS)) {
    return "critical";
  }

  if (actionType === "DELETE_FILE" || actionType === "SYSTEM_CHANGE") {
    return "critical";
  }

  if (
    actionType === "EVOLUTION_APPROVAL" ||
    actionType === "MEMORY_CLEANUP"
  ) {
    return "high";
  }

  if (
    actionType === "WRITE_FILE" ||
    actionType === "PATCH_FILE" ||
    actionType === "ROLLBACK_FILE"
  ) {
    if (includesPathPart(filePath, HIGH_RISK_PATH_PARTS)) {
      return "high";
    }

    return "medium";
  }

  return "low";
}

export function validatePendingAction(
  input: PendingActionInput
): PendingActionValidation {
  const reasons: string[] = [];
  const actionType = normalizeActionType(input.action_type);
  const filePath = normalizePath(input.file_path);
  const risk = detectActionRisk(input);

  if (!actionType) {
    reasons.push("Missing action_type");
  }

  if (actionType && !VALID_ACTION_TYPES.has(actionType)) {
    reasons.push(
      `Unknown action_type: ${actionType}. Use OTHER for custom actions.`
    );
  }

  if (FILE_ACTION_TYPES.has(actionType) && !filePath) {
    reasons.push("Missing file_path");
  }

  if (actionType === "WRITE_FILE" && !cleanContent(input.content)) {
    reasons.push("Missing content for WRITE_FILE");
  }

  if (actionType === "PATCH_FILE" && !cleanContent(input.patch)) {
    reasons.push("Missing patch for PATCH_FILE");
  }

  if (
    CONTENT_ACTION_TYPES.has(actionType) &&
    !cleanContent(input.content) &&
    !cleanContent(input.patch)
  ) {
    reasons.push("Missing content or patch");
  }

  if (isPathTraversal(filePath)) {
    reasons.push("Path traversal is blocked");
  }

  if (includesPathPart(filePath, BLOCKED_PATH_PARTS)) {
    reasons.push("Protected path is blocked");
  }

  if (actionType === "DELETE_FILE") {
    reasons.push("DELETE_FILE actions are blocked by policy");
  }

  if (actionType === "SYSTEM_CHANGE") {
    reasons.push("SYSTEM_CHANGE actions are blocked by policy");
  }

  if (risk === "critical") {
    reasons.push("Critical risk actions are blocked");
  }

  const blocked =
    risk === "critical" ||
    reasons.some((reason) =>
      reason.toLowerCase().includes("blocked")
    );

  const requiresApproval =
    input.requires_approval === true ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical";

  return {
    valid: reasons.length === 0,
    risk,
    requiresApproval,
    blocked,
    reasons: Array.from(new Set(reasons)),
  };
}

function cleanContent(value?: string) {
  return typeof value === "string" && value.trim().length > 0;
}

function buildPendingPayload(input: PendingActionInput) {
  const validation = validatePendingAction(input);
  const actionType = normalizeActionType(input.action_type);

  return {
    action_type: actionType || input.action_type,
    file_path: normalizePath(input.file_path),
    content: input.content || "",
    patch: input.patch || "",
    reason: input.reason || "",
    source: input.source || "awenia",
    status:
      validation.valid && !validation.blocked
        ? "pending"
        : "failed",
    risk: validation.risk,
    requires_approval: validation.requiresApproval,
    approved_by: null,
    approved_at: null,
    completed_at: null,
    rejected_at: null,
    cancelled_at: null,
    failure_reason:
      validation.valid && !validation.blocked
        ? ""
        : validation.reasons.join("; "),
    validation,
    metadata: input.metadata || {},
    created_at: now(),
    updated_at: now(),
  };
}

export async function savePendingAction(input: PendingActionInput) {
  const payload = buildPendingPayload(input);

  const { data, error } = await supabase
    .from("pending_actions")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function getPendingActions(limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  return data || [];
}

export async function getLatestPendingAction() {
  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;

  return data || null;
}

export async function getPendingActionById(id: string) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return null;

  return data || null;
}

export async function approvePendingAction(
  id: string,
  approvedBy = "Gabi"
) {
  const action = await getPendingActionById(id);

  if (!action) {
    return {
      success: false,
      status: "failed",
      reason: "Pending action not found",
    };
  }

  if (action.status !== "pending") {
    return {
      success: false,
      status: action.status,
      reason: `Action is not pending. Current status: ${action.status}`,
      action,
    };
  }

  const executionCheck = canExecutePendingAction({
    ...action,
    status: "approved",
    approved_by: approvedBy,
    approved_at: now(),
  });

  if (!executionCheck.allowed) {
    return {
      success: false,
      status: "failed",
      reason: executionCheck.reason,
      validation: executionCheck.validation,
      action,
    };
  }

  const { data, error } = await supabase
    .from("pending_actions")
    .update({
      status: "approved",
      approved_by: approvedBy,
      approved_at: now(),
      updated_at: now(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return {
    success: true,
    status: "approved",
    action: data,
  };
}

export async function completePendingAction(id: string) {
  const action = await getPendingActionById(id);

  if (!action) {
    throw new Error("Pending action not found");
  }

  const executionCheck = canExecutePendingAction(action);

  if (!executionCheck.allowed) {
    throw new Error(executionCheck.reason);
  }

  const { data, error } = await supabase
    .from("pending_actions")
    .update({
      status: "completed",
      completed_at: now(),
      updated_at: now(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function rejectPendingAction(
  id: string,
  reason = "Rejected by Gabi"
) {
  const { data, error } = await supabase
    .from("pending_actions")
    .update({
      status: "rejected",
      rejected_at: now(),
      rejection_reason: reason,
      updated_at: now(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function cancelPendingAction(
  id: string,
  reason = "Cancelled"
) {
  const { data, error } = await supabase
    .from("pending_actions")
    .update({
      status: "cancelled",
      cancelled_at: now(),
      cancellation_reason: reason,
      updated_at: now(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function failPendingAction(
  id: string,
  reason = "Pending action failed"
) {
  const { data, error } = await supabase
    .from("pending_actions")
    .update({
      status: "failed",
      failure_reason: reason,
      updated_at: now(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function getPendingActionHistory(limit = 50) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  return data || [];
}

export async function getPendingActionsByFile(filePath: string, limit = 20) {
  const normalized = normalizePath(filePath);
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("file_path", normalized)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  return data || [];
}

export async function getPendingActionStats() {
  const history = await getPendingActionHistory(100);

  const stats = {
    total: history.length,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
    failed: 0,
    highRisk: 0,
    criticalRisk: 0,
  };

  for (const action of history) {
    if (action.status === "pending") stats.pending += 1;
    if (action.status === "approved") stats.approved += 1;
    if (action.status === "completed") stats.completed += 1;
    if (action.status === "rejected") stats.rejected += 1;
    if (action.status === "cancelled") stats.cancelled += 1;
    if (action.status === "failed") stats.failed += 1;

    if (action.risk === "high") stats.highRisk += 1;
    if (action.risk === "critical") stats.criticalRisk += 1;
  }

  return {
    ...stats,
    timestamp: now(),
  };
}

export function analyzePendingActionRisk(input: PendingActionInput) {
  const validation = validatePendingAction(input);

  return {
    action_type: normalizeActionType(input.action_type),
    file_path: normalizePath(input.file_path),
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    blocked: validation.blocked,
    valid: validation.valid,
    reasons: validation.reasons,
    recommendation: validation.blocked
      ? "Do not execute this action"
      : validation.requiresApproval
        ? "Wait for Gabi approval before execution"
        : "Safe for low-risk execution",
    timestamp: now(),
  };
}

export function canExecutePendingAction(action: any) {
  if (!action) {
    return {
      allowed: false,
      reason: "Missing pending action",
      validation: null,
    };
  }

  const validation = validatePendingAction({
    action_type: action.action_type,
    file_path: action.file_path,
    content: action.content,
    patch: action.patch,
    risk: action.risk,
    requires_approval: action.requires_approval,
    metadata: action.metadata,
  });

  if (!validation.valid || validation.blocked) {
    return {
      allowed: false,
      reason:
        validation.reasons.join("; ") ||
        "Pending action validation failed",
      validation,
    };
  }

  if (
    action.status === "completed" ||
    action.status === "rejected" ||
    action.status === "cancelled" ||
    action.status === "failed"
  ) {
    return {
      allowed: false,
      reason: `Action cannot be executed with status: ${action.status}`,
      validation,
    };
  }

  const requiresApproval =
    action.requires_approval === true ||
    validation.requiresApproval;

  if (requiresApproval && action.status !== "approved") {
    return {
      allowed: false,
      reason: "Action requires approval from Gabi before execution",
      validation,
    };
  }

  if (
    requiresApproval &&
    (!action.approved_by || !action.approved_at)
  ) {
    return {
      allowed: false,
      reason: "Action approval metadata is missing",
      validation,
    };
  }

  if (!requiresApproval && action.status !== "pending" && action.status !== "approved") {
    return {
      allowed: false,
      reason: `Low-risk action has invalid execution status: ${action.status}`,
      validation,
    };
  }

  return {
    allowed: true,
    reason: requiresApproval
      ? "Action is approved and can be executed"
      : "Low-risk action can be executed",
    validation,
  };
}

export async function createPendingWriteAction(
  filePath: string,
  content: string,
  reason = "Awenia generated file update"
) {
  return savePendingAction({
    action_type: "WRITE_FILE",
    file_path: filePath,
    content,
    reason,
    source: "awenia_code_generation",
    requires_approval: true,
  });
}

export async function createPendingPatchAction(
  filePath: string,
  patch: string,
  reason = "Awenia generated patch"
) {
  return savePendingAction({
    action_type: "PATCH_FILE",
    file_path: filePath,
    patch,
    reason,
    source: "awenia_patch_generation",
    requires_approval: true,
  });
}