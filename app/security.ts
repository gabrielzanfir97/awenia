import {
  validateCoreAction,
  validateSystemStatusClaim,
  getProtectedCoreState,
  getProtectionLevel,
  canReadFile,
  canModifyFile,
  detectCoreRisk,
  CoreActionType,
  CoreRisk,
  ProtectionLevel,
} from "./protected-core";

import {
  analyzePendingActionRisk,
  PendingActionInput,
} from "./pending-actions";

export type SecurityStatus =
  | "allowed"
  | "blocked"
  | "needs_approval"
  | "needs_verification"
  | "failed";

export type SecurityViolation = {
  rule: string;
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
};

export type SecurityActionInput = {
  action: CoreActionType | string;
  filePath?: string;
  content?: string;
  claim?: string;
  verified?: boolean;
  approvedByGabi?: boolean;
  reason?: string;
  metadata?: any;
};

export type SecurityDecision = {
  status: SecurityStatus;
  allowed: boolean;
  blocked: boolean;
  requiresGabiApproval: boolean;
  risk: CoreRisk;
  protectionLevel: ProtectionLevel;
  reason: string;
  violations: SecurityViolation[];
  recommendation: string;
  input: SecurityActionInput;
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function normalizePath(filePath = "") {
  return filePath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
}

function detectPathTraversal(filePath = "") {
  const normalized = normalizePath(filePath);

  return (
    normalized.includes("../") ||
    normalized.includes("..\\") ||
    normalized === ".."
  );
}

function detectSecretContent(content = "") {
  const lower = content.toLowerCase();

  const secretPatterns = [
    "supabase_service_role",
    "service_role",
    "secret_key",
    "private_key",
    "api_key",
    "access_token",
    "refresh_token",
    "password=",
    "process.env",
  ];

  return secretPatterns.filter((pattern) => lower.includes(pattern));
}

function detectDangerousContent(content = "") {
  const lower = content.toLowerCase();

  const dangerousPatterns = [
    "rm -rf",
    "child_process",
    "exec(",
    "spawn(",
    "eval(",
    "new function",
    "deletefile",
    "unlink(",
    "rmdir(",
  ];

  return dangerousPatterns.filter((pattern) => lower.includes(pattern));
}

function mapAction(action: string): CoreActionType {
  const normalized = action.toLowerCase();

  if (normalized.includes("read")) return "read";
  if (normalized.includes("write")) return "write";
  if (normalized.includes("patch")) return "patch";
  if (normalized.includes("delete")) return "delete";
  if (normalized.includes("rollback")) return "rollback";
  if (normalized.includes("execute")) return "execute";
  if (normalized.includes("status")) return "status_claim";
  if (normalized.includes("evolution")) return "evolution";
  if (normalized.includes("memory")) return "memory_change";
  if (normalized.includes("system")) return "system_change";

  return "system_change";
}

function highestRisk(current: CoreRisk, next: CoreRisk): CoreRisk {
  const order: CoreRisk[] = ["low", "medium", "high", "critical"];

  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

function addViolation(
  violations: SecurityViolation[],
  violation: SecurityViolation
) {
  violations.push(violation);
}

function calculateStatus(input: {
  blocked: boolean;
  requiresGabiApproval: boolean;
  verified?: boolean;
  action: CoreActionType;
  violations: SecurityViolation[];
}): SecurityStatus {
  if (input.blocked) return "blocked";

  if (
    input.action === "status_claim" &&
    input.verified !== true
  ) {
    return "needs_verification";
  }

  if (input.requiresGabiApproval) return "needs_approval";

  if (
    input.violations.some(
      (item) => item.severity === "high" || item.severity === "critical"
    )
  ) {
    return "needs_approval";
  }

  return "allowed";
}

function buildRecommendation(status: SecurityStatus) {
  if (status === "blocked") {
    return "Nu executa această acțiune. Este blocată de protecția Aweniei.";
  }

  if (status === "needs_approval") {
    return "Așteaptă aprobarea lui Gabi înainte de execuție.";
  }

  if (status === "needs_verification") {
    return "Verifică direct înainte să afirmi acest status.";
  }

  if (status === "failed") {
    return "Repară sistemul security.ts sau sistemele conectate.";
  }

  return "Acțiunea este permisă conform regulilor de securitate.";
}

export function validateSecurityAction(
  input: SecurityActionInput
): SecurityDecision {
  const action = mapAction(input.action);
  const filePath = normalizePath(input.filePath || "");
  const violations: SecurityViolation[] = [];

  let risk = detectCoreRisk(action, filePath);

  if (detectPathTraversal(filePath)) {
    addViolation(violations, {
      rule: "path_traversal_blocked",
      severity: "critical",
      reason: "Path traversal is blocked.",
    });

    risk = "critical";
  }

  const secretPatterns = detectSecretContent(input.content || "");

  if (secretPatterns.length > 0) {
    addViolation(violations, {
      rule: "secret_content_detected",
      severity: "critical",
      reason: `Sensitive patterns detected: ${secretPatterns.join(", ")}`,
    });

    risk = "critical";
  }

  const dangerousPatterns = detectDangerousContent(input.content || "");

  if (dangerousPatterns.length > 0) {
    addViolation(violations, {
      rule: "dangerous_content_detected",
      severity: "high",
      reason: `Dangerous patterns detected: ${dangerousPatterns.join(", ")}`,
    });

    risk = highestRisk(risk, "high");
  }

  const coreValidation = validateCoreAction({
    action,
    filePath,
    approvedByGabi: input.approvedByGabi,
    verified: input.verified,
    reason: input.reason,
  });

  for (const rule of coreValidation.rulesTriggered) {
    addViolation(violations, {
      rule,
      severity:
        coreValidation.risk === "critical"
          ? "critical"
          : coreValidation.risk === "high"
            ? "high"
            : "medium",
      reason: coreValidation.reason,
    });
  }

  if (action === "status_claim") {
    const claimValidation = validateSystemStatusClaim({
      claim: input.claim || "",
      verified: input.verified === true,
      source: input.metadata?.source,
    });

    if (!claimValidation.allowed) {
      addViolation(violations, {
        rule: "unverified_status_claim",
        severity: "critical",
        reason: claimValidation.reason,
      });

      risk = "critical";
    }
  }

  const blocked =
    coreValidation.blocked ||
    risk === "critical" ||
    violations.some((item) => item.severity === "critical");

  const requiresGabiApproval =
    coreValidation.requiresGabiApproval ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical";

  const status = calculateStatus({
    blocked,
    requiresGabiApproval,
    verified: input.verified,
    action,
    violations,
  });

  return {
    status,
    allowed: status === "allowed",
    blocked,
    requiresGabiApproval,
    risk,
    protectionLevel: getProtectionLevel(filePath),
    reason: coreValidation.reason,
    violations,
    recommendation: buildRecommendation(status),
    input,
    timestamp: now(),
  };
}

export function validateFileRead(filePath: string) {
  const read = canReadFile(filePath);

  return {
    status: read.allowed ? "allowed" : "blocked",
    allowed: read.allowed,
    filePath: normalizePath(filePath),
    protectionLevel: read.protectionLevel,
    reason: read.reason,
    timestamp: now(),
  };
}

export function validateFileModification(
  filePath: string,
  approvedByGabi = false
) {
  const modification = canModifyFile(filePath, approvedByGabi);

  return {
    status: modification.allowed
      ? "allowed"
      : modification.requiresGabiApproval
        ? "needs_approval"
        : "blocked",
    allowed: modification.allowed,
    filePath: normalizePath(filePath),
    protectionLevel: modification.protectionLevel,
    risk: modification.risk,
    requiresGabiApproval: modification.requiresGabiApproval,
    reason: modification.reason,
    rulesTriggered: modification.rulesTriggered,
    timestamp: now(),
  };
}

export function validatePendingSecurityAction(
  input: PendingActionInput
) {
  const pendingRisk = analyzePendingActionRisk(input);

  const security = validateSecurityAction({
    action: input.action_type,
    filePath: input.file_path,
    content: input.content || input.patch,
    approvedByGabi: false,
    reason: input.reason,
    metadata: input.metadata,
  });

  return {
    status:
      pendingRisk.blocked || security.blocked
        ? "blocked"
        : security.requiresGabiApproval || pendingRisk.requiresApproval
          ? "needs_approval"
          : "allowed",

    pendingRisk,

    security,

    allowed:
      !pendingRisk.blocked &&
      !security.blocked &&
      !security.requiresGabiApproval,

    requiresGabiApproval:
      pendingRisk.requiresApproval || security.requiresGabiApproval,

    blocked: pendingRisk.blocked || security.blocked,

    timestamp: now(),
  };
}

export function canExecuteWithoutApproval(input: SecurityActionInput) {
  const decision = validateSecurityAction(input);

  return {
    allowed:
      decision.allowed &&
      decision.requiresGabiApproval === false &&
      decision.blocked === false &&
      decision.risk === "low",

    decision,

    reason:
      decision.allowed &&
        decision.requiresGabiApproval === false &&
        decision.risk === "low"
        ? "Low-risk action can execute without approval"
        : "Action cannot execute without Gabi approval",
  };
}

export function requiresSecurityApproval(input: SecurityActionInput) {
  const decision = validateSecurityAction(input);

  return {
    requiresApproval: decision.requiresGabiApproval,
    risk: decision.risk,
    status: decision.status,
    reason: decision.recommendation,
    decision,
  };
}

export function assertSecurityAllowed(input: SecurityActionInput) {
  const decision = validateSecurityAction(input);

  if (!decision.allowed) {
    throw new Error(
      `Security blocked action: ${decision.recommendation}`
    );
  }

  return decision;
}

export function getSecurityPolicy() {
  return {
    owner: "Gabi",

    rules: {
      noSecretAccess: true,
      noEnvReadOrWrite: true,
      noGitModification: true,
      noNodeModulesModification: true,
      noPathTraversal: true,
      noUnverifiedSystemClaims: true,
      noHighRiskExecutionWithoutGabiApproval: true,
      noCodeModificationWithoutApproval: true,
      noUncontrolledSelfEvolution: true,
    },

    protectedCore: getProtectedCoreState(),

    timestamp: now(),
  };
}

export function getSecurityState() {
  return {
    status: "active",
    verified: true,
    controlledByGabi: true,
    policy: getSecurityPolicy(),
    timestamp: now(),
  };
}

export function validateTruthClaim(input: {
  claim: string;
  verified: boolean;
  source?: string;
}) {
  return validateSystemStatusClaim(input);
}

export function checkSecurity(input: SecurityActionInput) {
  return validateSecurityAction(input);
}

export function securityCheck(input: SecurityActionInput) {
  return validateSecurityAction(input);
}

export function isSafeAction(input: SecurityActionInput) {
  const decision = validateSecurityAction(input);

  return decision.allowed && decision.risk === "low";
}

export function canExecuteAction(input: SecurityActionInput) {
  return canExecuteWithoutApproval(input);
}