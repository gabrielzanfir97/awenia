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

const CRITICAL_PATH_PARTS = [
  ".env",
  ".env.local",
  ".git",
  "node_modules",
  "app/protected-core.ts",
];

const HIGH_RISK_PATH_PARTS = [
  "app/api/",
  "app/api/awenia/route.ts",
  "app/memory-store.ts",
  "app/supabase.ts",
  "app/dev-agent.ts",
  "app/pending-actions.ts",
  "app/security.ts",
];

const CRITICAL_SECRET_PATTERNS = [
  "supabase_service_role",
  "service_role",
  "private_key",
  "secret_key",
  "access_token",
  "refresh_token",
  "password=",
  "bearer ",
  "sb_secret",
  "sk-",
];

const SENSITIVE_WARNING_PATTERNS = [
  "process.env",
  "api_key",
  "apikey",
  "token",
  "secret",
];

const DANGEROUS_CODE_PATTERNS = [
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

function now() {
  return new Date().toISOString();
}

function normalizePath(filePath = "") {
  return String(filePath)
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .trim();
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function detectPathTraversal(filePath = "") {
  const normalized = normalizePath(filePath);

  return (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  );
}

function pathMatchesPart(filePath: string, part: string) {
  const normalized = normalizePath(filePath).toLowerCase();
  const normalizedPart = normalizePath(part).toLowerCase();

  return (
    normalized === normalizedPart ||
    normalized.startsWith(`${normalizedPart}/`) ||
    normalized.includes(`/${normalizedPart}/`) ||
    normalized.includes(normalizedPart)
  );
}

function includesPathPart(filePath: string, parts: string[]) {
  return parts.some((part) => pathMatchesPart(filePath, part));
}

function detectSecretContent(content = "") {
  const lower = content.toLowerCase();

  return CRITICAL_SECRET_PATTERNS.filter((pattern) =>
    lower.includes(pattern)
  );
}

function detectSensitiveWarnings(content = "") {
  const lower = content.toLowerCase();

  return SENSITIVE_WARNING_PATTERNS.filter((pattern) =>
    lower.includes(pattern)
  );
}

function detectDangerousContent(content = "") {
  const lower = content.toLowerCase();

  return DANGEROUS_CODE_PATTERNS.filter((pattern) =>
    lower.includes(pattern)
  );
}

function mapAction(action: string): CoreActionType {
  const normalized = normalizeText(action).toLowerCase();

  if (
    normalized === "read" ||
    normalized.includes("read") ||
    normalized.includes("list") ||
    normalized.includes("search") ||
    normalized.includes("analyze") ||
    normalized.includes("check")
  ) {
    return "read";
  }

  if (
    normalized === "status" ||
    normalized === "status_claim" ||
    normalized.includes("status_claim") ||
    normalized.includes("claim")
  ) {
    return "status_claim";
  }

  if (
    normalized === "write" ||
    normalized.includes("write") ||
    normalized.includes("write_file")
  ) {
    return "write";
  }

  if (
    normalized === "patch" ||
    normalized.includes("patch") ||
    normalized.includes("edit") ||
    normalized.includes("modify")
  ) {
    return "patch";
  }

  if (
    normalized === "rollback" ||
    normalized.includes("rollback") ||
    normalized.includes("restore")
  ) {
    return "rollback";
  }

  if (
    normalized === "delete" ||
    normalized.includes("delete") ||
    normalized.includes("remove")
  ) {
    return "delete";
  }

  if (
    normalized === "execute" ||
    normalized.includes("execute") ||
    normalized.includes("run_background")
  ) {
    return "execute";
  }

  if (
    normalized === "evolution" ||
    normalized.includes("evolution")
  ) {
    return "evolution";
  }

  if (
    normalized === "memory_change" ||
    normalized.includes("memory")
  ) {
    return "memory_change";
  }

  if (
    normalized === "system_change" ||
    normalized.includes("system")
  ) {
    return "system_change";
  }

  return "read";
}

function highestRisk(current: CoreRisk, next: CoreRisk): CoreRisk {
  const order: CoreRisk[] = ["low", "medium", "high", "critical"];

  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

function addViolation(
  violations: SecurityViolation[],
  violation: SecurityViolation
) {
  const exists = violations.some(
    (item) =>
      item.rule === violation.rule &&
      item.reason === violation.reason
  );

  if (!exists) {
    violations.push(violation);
  }
}

function actionUsuallyRequiresApproval(action: CoreActionType) {
  return (
    action === "write" ||
    action === "patch" ||
    action === "rollback" ||
    action === "execute" ||
    action === "evolution" ||
    action === "memory_change"
  );
}

function actionIsAlwaysBlocked(action: CoreActionType) {
  return action === "delete" || action === "system_change";
}

function calculateStatus(input: {
  hardBlocked: boolean;
  requiresGabiApproval: boolean;
  approvedByGabi?: boolean;
  verified?: boolean;
  action: CoreActionType;
}): SecurityStatus {
  if (input.hardBlocked) return "blocked";

  if (
    input.action === "status_claim" &&
    input.verified !== true
  ) {
    return "needs_verification";
  }

  if (
    input.requiresGabiApproval &&
    input.approvedByGabi !== true
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

function buildReason(
  status: SecurityStatus,
  coreReason: string,
  violations: SecurityViolation[]
) {
  if (violations.length > 0) {
    return violations.map((item) => item.reason).join("; ");
  }

  if (coreReason) return coreReason;

  if (status === "allowed") return "Security action allowed";

  return buildRecommendation(status);
}

function safeProtectionLevel(filePath: string): ProtectionLevel {
  try {
    return getProtectionLevel(filePath);
  } catch {
    return "restricted" as ProtectionLevel;
  }
}

export function validateSecurityAction(
  input: SecurityActionInput
): SecurityDecision {
  try {
    const action = mapAction(input.action);
    const filePath = normalizePath(input.filePath || "");
    const content = normalizeText(input.content || "");
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

    if (filePath && includesPathPart(filePath, CRITICAL_PATH_PARTS)) {
      addViolation(violations, {
        rule: "protected_path_blocked",
        severity: "critical",
        reason: "Protected path is blocked.",
      });

      risk = "critical";
    }

    if (filePath && includesPathPart(filePath, HIGH_RISK_PATH_PARTS)) {
      risk = highestRisk(risk, "high");

      addViolation(violations, {
        rule: "high_risk_path",
        severity: "high",
        reason: "High-risk project file detected.",
      });
    }

    const secretPatterns = detectSecretContent(content);

    if (secretPatterns.length > 0) {
      addViolation(violations, {
        rule: "secret_content_detected",
        severity: "critical",
        reason: `Sensitive secret patterns detected: ${secretPatterns.join(
          ", "
        )}`,
      });

      risk = "critical";
    }

    const warningPatterns = detectSensitiveWarnings(content);

    if (warningPatterns.length > 0 && secretPatterns.length === 0) {
      addViolation(violations, {
        rule: "sensitive_content_warning",
        severity: "medium",
        reason: `Sensitive-looking patterns detected and require review: ${warningPatterns.join(
          ", "
        )}`,
      });

      risk = highestRisk(risk, "medium");
    }

    const dangerousPatterns = detectDangerousContent(content);

    if (dangerousPatterns.length > 0) {
      addViolation(violations, {
        rule: "dangerous_content_detected",
        severity: "high",
        reason: `Dangerous code patterns detected: ${dangerousPatterns.join(
          ", "
        )}`,
      });

      risk = highestRisk(risk, "high");
    }

    if (actionIsAlwaysBlocked(action)) {
      addViolation(violations, {
        rule: "action_blocked_by_policy",
        severity: "critical",
        reason: `${action} actions are blocked by Awenia security policy.`,
      });

      risk = "critical";
    }

    const coreValidation = validateCoreAction({
      action,
      filePath,
      approvedByGabi: input.approvedByGabi,
      verified: input.verified,
      reason: input.reason,
    });

    risk = highestRisk(risk, coreValidation.risk);

    for (const rule of coreValidation.rulesTriggered || []) {
      addViolation(violations, {
        rule,
        severity:
          coreValidation.risk === "critical"
            ? "critical"
            : coreValidation.risk === "high"
              ? "high"
              : coreValidation.risk === "medium"
                ? "medium"
                : "low",
        reason: coreValidation.reason,
      });
    }

    if (action === "status_claim") {
      const claimValidation = validateSystemStatusClaim({
        claim: input.claim || content || input.reason || "",
        verified: input.verified === true,
        source: input.metadata?.source,
      });

      if (!claimValidation.allowed) {
        addViolation(violations, {
          rule: "unverified_status_claim",
          severity: "medium",
          reason: claimValidation.reason,
        });

        risk = highestRisk(risk, "medium");
      }
    }

    const hardBlocked =
      risk === "critical" ||
      actionIsAlwaysBlocked(action) ||
      violations.some((item) => item.severity === "critical");

    const requiresGabiApproval =
      hardBlocked ||
      actionUsuallyRequiresApproval(action) ||
      coreValidation.requiresGabiApproval ||
      risk === "medium" ||
      risk === "high";

    const status = calculateStatus({
      hardBlocked,
      requiresGabiApproval,
      approvedByGabi: input.approvedByGabi,
      verified: input.verified,
      action,
    });

    const allowed = status === "allowed";

    return {
      status,
      allowed,
      blocked: status === "blocked",
      requiresGabiApproval,
      risk,
      protectionLevel: safeProtectionLevel(filePath),
      reason: buildReason(
        status,
        coreValidation.reason,
        violations
      ),
      violations,
      recommendation: buildRecommendation(status),
      input,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed",
      allowed: false,
      blocked: true,
      requiresGabiApproval: true,
      risk: "critical",
      protectionLevel: safeProtectionLevel(input.filePath || ""),
      reason: error?.message || "Security validation failed",
      violations: [
        {
          rule: "security_validation_failed",
          severity: "critical",
          reason: error?.message || "Security validation failed",
        },
      ],
      recommendation: buildRecommendation("failed"),
      input,
      timestamp: now(),
    };
  }
}

export function validateFileRead(filePath: string) {
  const normalized = normalizePath(filePath);
  const read = canReadFile(normalized);

  return {
    status: read.allowed ? "allowed" : "blocked",
    allowed: read.allowed,
    filePath: normalized,
    protectionLevel: read.protectionLevel,
    reason: read.reason,
    timestamp: now(),
  };
}

export function validateFileModification(
  filePath: string,
  approvedByGabi = false
) {
  const normalized = normalizePath(filePath);
  const modification = canModifyFile(normalized, approvedByGabi);

  return {
    status: modification.allowed
      ? "allowed"
      : modification.requiresGabiApproval
        ? "needs_approval"
        : "blocked",
    allowed: modification.allowed,
    filePath: normalized,
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
    content: input.content || input.patch || "",
    approvedByGabi: false,
    reason: input.reason,
    metadata: input.metadata,
  });

  const blocked = pendingRisk.blocked || security.blocked;

  const requiresGabiApproval =
    pendingRisk.requiresApproval || security.requiresGabiApproval;

  const status: SecurityStatus = blocked
    ? "blocked"
    : requiresGabiApproval
      ? "needs_approval"
      : "allowed";

  return {
    status,

    pendingRisk,

    security,

    allowed:
      status === "allowed" &&
      !pendingRisk.blocked &&
      !security.blocked,

    requiresGabiApproval,

    blocked,

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
      readAndStatusCommandsAreNotExecuteActions: true,
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
    truthPolicy: {
      policyLoaded: true,
      runtimeClaimsStillNeedDirectVerification: true,
    },
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