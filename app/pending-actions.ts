import { supabase } from "./supabase";

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
  "app/route.ts",
  "app/api/awenia/route.ts",
  "app/dev-agent.ts",
  "app/pending-actions.ts",
  "app/security.ts",
];

function now() {
  return new Date().toISOString();
}

function normalizePath(filePath = "") {
  return filePath.replace(/\\/g, "/").trim();
}

function includesPathPart(filePath: string, parts: string[]) {
  const normalized = normalizePath(filePath).toLowerCase();

  return parts.some((part) =>
    normalized.includes(part.toLowerCase())
  );
}

function isPathTraversal(filePath: string) {
  const normalized = normalizePath(filePath);

  return (
    normalized.includes("../") ||
    normalized.startsWith("/") ||
    normalized.includes("..\\")
  );
}

function detectActionRisk(input: PendingActionInput): PendingActionRisk {
  const actionType = input.action_type;
  const filePath = normalizePath(input.file_path);

  if (input.risk) return input.risk;

  if (isPathTraversal(filePath)) return "critical";

  if (includesPathPart(filePath, BLOCKED_PATH_PARTS)) {
    return "critical";
  }

  if (
    actionType === "DELETE_FILE" ||
    actionType === "SYSTEM_CHANGE" ||
    actionType === "EVOLUTION_APPROVAL"
  ) {
    return "critical";
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

  if (actionType === "MEMORY_CLEANUP") return "high";

  return "low";
}

export function validatePendingAction(
  input: PendingActionInput
): PendingActionValidation {
  const reasons: string[] = [];
  const filePath = normalizePath(input.file_path);
  const risk = detectActionRisk(input);

  if (!input.action_type) {
    reasons.push("Missing action_type");
  }

  if (
    ["WRITE_FILE", "PATCH_FILE", "DELETE_FILE", "ROLLBACK_FILE"].includes(
      input.action_type
    ) &&
    !filePath
  ) {
    reasons.push("Missing file_path");
  }

  if (
    ["WRITE_FILE", "PATCH_FILE"].includes(input.action_type) &&
    !input.content &&
    !input.patch
  ) {
    reasons.push("Missing content or patch");
  }

  if (isPathTraversal(filePath)) {
    reasons.push("Path traversal is blocked");
  }

  if (includesPathPart(filePath, BLOCKED_PATH_PARTS)) {
    reasons.push("Protected path is blocked");
  }

  const blocked = risk === "critical" && reasons.length > 0;

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
    reasons,
  };
}

export async function savePendingAction(input: PendingActionInput) {
  const validation = validatePendingAction(input);

  const payload = {
    action_type: input.action_type,
    file_path: normalizePath(input.file_path),
    content: input.content || "",
    patch: input.patch || "",
    reason: input.reason || "",
    source: input.source || "awenia",
    status: validation.blocked ? "failed" : "pending",
    risk: validation.risk,
    requires_approval: validation.requiresApproval,
    approved_by: null,
    approved_at: null,
    completed_at: null,
    rejected_at: null,
    cancelled_at: null,
    failure_reason: validation.blocked
      ? validation.reasons.join("; ")
      : "",
    validation,
    metadata: input.metadata || {},
    created_at: now(),
    updated_at: now(),
  };

  const { data, error } = await supabase
    .from("pending_actions")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function getPendingActions(limit = 20) {
  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

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
  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return data || [];
}

export async function getPendingActionsByFile(filePath: string, limit = 20) {
  const normalized = normalizePath(filePath);

  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("file_path", normalized)
    .order("created_at", { ascending: false })
    .limit(limit);

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
    if (action.status && stats[action.status as keyof typeof stats] !== undefined) {
      stats[action.status as keyof typeof stats] += 1;
    }

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
    action_type: input.action_type,
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
  const validation = validatePendingAction({
    action_type: action.action_type,
    file_path: action.file_path,
    content: action.content,
    patch: action.patch,
    risk: action.risk,
    requires_approval: action.requires_approval,
  });

  if (!validation.valid || validation.blocked) {
    return {
      allowed: false,
      reason: validation.reasons.join("; "),
      validation,
    };
  }

  if (
    action.requires_approval === true &&
    action.status !== "approved" &&
    action.status !== "pending"
  ) {
    return {
      allowed: false,
      reason: "Action requires approval and is not approved",
      validation,
    };
  }

  return {
    allowed: true,
    reason: "Pending action can be executed after approval flow",
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
  });
}