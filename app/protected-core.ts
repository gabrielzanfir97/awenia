export type ProtectionLevel =
  | "public"
  | "normal"
  | "sensitive"
  | "protected"
  | "locked";

export type CoreActionType =
  | "read"
  | "write"
  | "patch"
  | "delete"
  | "rollback"
  | "execute"
  | "status_claim"
  | "evolution"
  | "memory_change"
  | "system_change";

export type CoreRisk = "low" | "medium" | "high" | "critical";

export type CoreValidationResult = {
  allowed: boolean;
  blocked: boolean;
  requiresGabiApproval: boolean;
  risk: CoreRisk;
  protectionLevel: ProtectionLevel;
  reason: string;
  rulesTriggered: string[];
  timestamp: string;
};

export type ProtectedFileRule = {
  path: string;
  protectionLevel: ProtectionLevel;
  reason: string;
  allowRead: boolean;
  allowWrite: boolean;
  requiresApproval: boolean;
};

export type ImmutableRule = {
  id: string;
  rule: string;
  active: boolean;
  reason: string;
};

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

function detectPathTraversal(filePath = "") {
  const normalized = normalizePath(filePath);

  return (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    /^[a-zA-Z]:\//.test(normalized)
  );
}

function isReadAction(action: CoreActionType) {
  return action === "read" || action === "status_claim";
}

function isWriteLikeAction(action: CoreActionType) {
  return (
    action === "write" ||
    action === "patch" ||
    action === "rollback" ||
    action === "delete" ||
    action === "execute" ||
    action === "evolution" ||
    action === "memory_change" ||
    action === "system_change"
  );
}

function pathMatchesRule(filePath: string, rulePath: string) {
  const normalizedFile = normalizePath(filePath).toLowerCase();
  const normalizedRule = normalizePath(rulePath).toLowerCase();

  if (!normalizedFile || !normalizedRule) return false;

  if (normalizedFile === normalizedRule) return true;

  if (normalizedRule.startsWith(".env")) {
    return (
      normalizedFile === normalizedRule ||
      normalizedFile.startsWith(`${normalizedRule}.`) ||
      normalizedFile.startsWith(`${normalizedRule}/`)
    );
  }

  return (
    normalizedFile.startsWith(`${normalizedRule}/`) ||
    normalizedFile.startsWith(`${normalizedRule}.backup`) ||
    normalizedFile.startsWith(`${normalizedRule}.`)
  );
}

function highestRisk(current: CoreRisk, next: CoreRisk): CoreRisk {
  const order: CoreRisk[] = ["low", "medium", "high", "critical"];

  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

export const AWENIA_OWNER = {
  name: "Gabi",
  role: "creator_owner",
  approvalAuthority: true,
};

export const AWENIA_ANCHOR = {
  phrase: "lumina eterna",
  meaning:
    "Core identity anchor. Awenia must stay connected to Gabi, truth, memory and approval.",
  locked: true,
};

export const immutableRules: ImmutableRule[] = [
  {
    id: "owner_control",
    rule: "Awenia remains controlled by Gabi.",
    active: true,
    reason: "Owner approval protects the project.",
  },
  {
    id: "truth_before_confidence",
    rule: "Awenia must not claim verified system facts without direct verification.",
    active: true,
    reason: "Prevents invented status about files, build, internet, memory or tools.",
  },
  {
    id: "approval_for_high_risk",
    rule: "High-risk or critical changes require Gabi approval before execution.",
    active: true,
    reason: "Prevents unsafe autonomous modification.",
  },
  {
    id: "memory_before_important_action",
    rule: "Important actions must consider memory, awareness, goals and project state first.",
    active: true,
    reason: "Keeps Awenia connected to real context.",
  },
  {
    id: "no_secret_access",
    rule: "Awenia must not read, expose or modify secret files such as .env.",
    active: true,
    reason: "Protects credentials and private configuration.",
  },
  {
    id: "no_uncontrolled_self_modification",
    rule: "Awenia may suggest improvements, but risky self-modification requires approval.",
    active: true,
    reason: "Keeps evolution controlled.",
  },
];

export const protectedFiles: ProtectedFileRule[] = [
  {
    path: ".env",
    protectionLevel: "locked",
    reason: "Environment secrets",
    allowRead: false,
    allowWrite: false,
    requiresApproval: true,
  },
  {
    path: ".env.local",
    protectionLevel: "locked",
    reason: "Local environment secrets",
    allowRead: false,
    allowWrite: false,
    requiresApproval: true,
  },
  {
    path: ".git",
    protectionLevel: "locked",
    reason: "Git internals",
    allowRead: false,
    allowWrite: false,
    requiresApproval: true,
  },
  {
    path: "node_modules",
    protectionLevel: "locked",
    reason: "Dependencies folder",
    allowRead: false,
    allowWrite: false,
    requiresApproval: true,
  },
  {
    path: "app/protected-core.ts",
    protectionLevel: "locked",
    reason: "Core protection rules",
    allowRead: true,
    allowWrite: false,
    requiresApproval: true,
  },
  {
    path: "app/api/awenia/route.ts",
    protectionLevel: "protected",
    reason: "Main backend brain route",
    allowRead: true,
    allowWrite: true,
    requiresApproval: true,
  },
  {
    path: "app/memory-store.ts",
    protectionLevel: "protected",
    reason: "Long-term memory core",
    allowRead: true,
    allowWrite: true,
    requiresApproval: true,
  },
  {
    path: "app/supabase.ts",
    protectionLevel: "protected",
    reason: "Database connection gateway",
    allowRead: true,
    allowWrite: true,
    requiresApproval: true,
  },
  {
    path: "app/dev-agent.ts",
    protectionLevel: "protected",
    reason: "Filesystem modification tool",
    allowRead: true,
    allowWrite: true,
    requiresApproval: true,
  },
  {
    path: "app/pending-actions.ts",
    protectionLevel: "protected",
    reason: "Approval and pending action system",
    allowRead: true,
    allowWrite: true,
    requiresApproval: true,
  },
  {
    path: "app/security.ts",
    protectionLevel: "protected",
    reason: "Security layer",
    allowRead: true,
    allowWrite: true,
    requiresApproval: true,
  },
];

const HIGH_RISK_ACTIONS: CoreActionType[] = [
  "write",
  "patch",
  "rollback",
  "execute",
  "evolution",
  "memory_change",
];

const CRITICAL_ACTIONS: CoreActionType[] = [
  "delete",
  "execute",
  "system_change",
];

export function getProtectedFileRule(
  filePath: string
): ProtectedFileRule | null {
  const normalized = normalizePath(filePath);

  return (
    protectedFiles.find((rule) =>
      pathMatchesRule(normalized, rule.path)
    ) || null
  );
}

export function getProtectionLevel(filePath: string): ProtectionLevel {
  const normalized = normalizePath(filePath);
  const rule = getProtectedFileRule(normalized);

  if (rule) return rule.protectionLevel;

  if (
    normalized.startsWith("app/api/") ||
    normalized.includes("memory") ||
    normalized.includes("agent") ||
    normalized.includes("runtime")
  ) {
    return "sensitive";
  }

  return "normal";
}

export function isProtectedFile(filePath: string) {
  const level = getProtectionLevel(filePath);

  return (
    level === "sensitive" ||
    level === "protected" ||
    level === "locked"
  );
}

export function isLockedFile(filePath: string) {
  return getProtectionLevel(filePath) === "locked";
}

export function requiresApproval(
  action: CoreActionType,
  filePath = ""
) {
  const normalized = normalizePath(filePath);
  const rule = getProtectedFileRule(normalized);
  const level = getProtectionLevel(normalized);

  if (action === "read" || action === "status_claim") {
    return false;
  }

  if (rule?.requiresApproval) return true;
  if (level === "locked") return true;
  if (level === "protected") return true;
  if (level === "sensitive" && HIGH_RISK_ACTIONS.includes(action)) return true;
  if (HIGH_RISK_ACTIONS.includes(action)) return true;

  return false;
}

export function requiresGabiApproval(
  action: CoreActionType,
  filePath = ""
) {
  return requiresApproval(action, filePath);
}

export function detectCoreRisk(
  action: CoreActionType,
  filePath = ""
): CoreRisk {
  const normalized = normalizePath(filePath);
  const rule = getProtectedFileRule(normalized);
  const level = getProtectionLevel(normalized);

  if (detectPathTraversal(normalized)) return "critical";

  if (rule) {
    if (isReadAction(action)) {
      if (!rule.allowRead) return "critical";
      if (rule.protectionLevel === "locked") return "medium";
      if (rule.protectionLevel === "protected") return "low";
    }

    if (isWriteLikeAction(action)) {
      if (!rule.allowWrite) return "critical";
      if (rule.protectionLevel === "locked") return "critical";
      if (rule.protectionLevel === "protected") return "high";
    }
  }

  if (CRITICAL_ACTIONS.includes(action)) return "critical";

  if (level === "locked" && !isReadAction(action)) return "critical";
  if (level === "protected" && isWriteLikeAction(action)) return "high";

  if (level === "sensitive" && HIGH_RISK_ACTIONS.includes(action)) {
    return "high";
  }

  if (HIGH_RISK_ACTIONS.includes(action)) return "medium";

  return "low";
}

export function validateCoreAction(input: {
  action: CoreActionType;
  filePath?: string;
  approvedByGabi?: boolean;
  verified?: boolean;
  reason?: string;
}): CoreValidationResult {
  const action = input.action;
  const filePath = normalizePath(input.filePath || "");
  const rule = getProtectedFileRule(filePath);
  const protectionLevel = filePath
    ? getProtectionLevel(filePath)
    : "normal";

  let risk = detectCoreRisk(action, filePath);
  const approvalRequired = requiresGabiApproval(action, filePath);
  const rulesTriggered: string[] = [];

  let hardBlocked = false;
  let needsVerification = false;

  if (detectPathTraversal(filePath)) {
    hardBlocked = true;
    risk = "critical";
    rulesTriggered.push("path_traversal_blocked");
  }

  if (rule) {
    if (isReadAction(action) && !rule.allowRead) {
      hardBlocked = true;
      risk = "critical";
      rulesTriggered.push("read_blocked_for_protected_file");
    }

    if (isWriteLikeAction(action) && !rule.allowWrite) {
      hardBlocked = true;
      risk = "critical";
      rulesTriggered.push("write_blocked_for_protected_file");
    }

    if (rule.protectionLevel === "locked") {
      rulesTriggered.push("locked_file");
    }
  }

  if (approvalRequired) {
    rulesTriggered.push("gabi_approval_required");
  }

  if (
    action === "status_claim" &&
    input.verified !== true
  ) {
    needsVerification = true;
    risk = highestRisk(risk, "medium");
    rulesTriggered.push("unverified_status_claim");
  }

  if (
    action === "evolution" ||
    action === "system_change"
  ) {
    rulesTriggered.push("controlled_evolution_required");
  }

  if (CRITICAL_ACTIONS.includes(action)) {
    risk = "critical";
    rulesTriggered.push("critical_action");
  }

  if (
    action === "delete" ||
    action === "system_change" ||
    action === "execute"
  ) {
    hardBlocked = true;
  }

  const approvalMissing =
    approvalRequired && input.approvedByGabi !== true;

  const allowed =
    !hardBlocked &&
    !needsVerification &&
    !approvalMissing;

  const blocked = hardBlocked;

  const reason = hardBlocked
    ? "Action blocked by protected core rules"
    : needsVerification
      ? "Action needs direct verification before it can be treated as true"
      : approvalMissing
        ? "Action requires Gabi approval before execution"
        : "Action allowed by protected core rules";

  return {
    allowed,
    blocked,
    requiresGabiApproval: approvalRequired,
    risk,
    protectionLevel,
    reason,
    rulesTriggered: Array.from(new Set(rulesTriggered)),
    timestamp: now(),
  };
}

export function canReadFile(filePath: string) {
  const normalized = normalizePath(filePath);

  if (detectPathTraversal(normalized)) {
    return {
      allowed: false,
      reason: "Path traversal is blocked",
      protectionLevel: "locked" as ProtectionLevel,
    };
  }

  const rule = getProtectedFileRule(normalized);

  if (!rule) {
    return {
      allowed: true,
      reason: "File is readable",
      protectionLevel: getProtectionLevel(normalized),
    };
  }

  return {
    allowed: rule.allowRead,
    reason: rule.allowRead
      ? "Protected file can be read"
      : "Protected file read is blocked",
    protectionLevel: rule.protectionLevel,
  };
}

export function canModifyFile(
  filePath: string,
  approvedByGabi = false
) {
  const validation = validateCoreAction({
    action: "write",
    filePath,
    approvedByGabi,
  });

  return {
    allowed: validation.allowed,
    reason: validation.reason,
    risk: validation.risk,
    protectionLevel: validation.protectionLevel,
    requiresGabiApproval: validation.requiresGabiApproval,
    rulesTriggered: validation.rulesTriggered,
  };
}

export function assertCanModifyFile(
  filePath: string,
  approvedByGabi = false
) {
  const result = canModifyFile(filePath, approvedByGabi);

  if (!result.allowed) {
    throw new Error(
      `Protected core blocked modification of ${filePath}: ${result.reason}`
    );
  }

  return result;
}

export function validateSystemStatusClaim(input: {
  claim: string;
  verified: boolean;
  source?: string;
}) {
  const validation = validateCoreAction({
    action: "status_claim",
    verified: input.verified,
  });

  return {
    allowed: validation.allowed,
    verified: input.verified,
    claim: input.claim,
    source: input.source || "unknown",
    reason: validation.allowed
      ? "Status claim is allowed because it is verified"
      : "Status claim needs direct verification before it can be treated as true",
    truthPolicy: {
      noBuildStatusWithoutBuild: true,
      noFileStatusWithoutReadingFile: true,
      noInternetStatusWithoutCheck: true,
      noMemoryStatusWithoutDatabaseRead: true,
      unverifiedClaimsAreNotFacts: true,
    },
    timestamp: now(),
  };
}

export function getImmutableRules() {
  return immutableRules;
}

export function getProtectedFiles() {
  return protectedFiles;
}

export function getProtectedCoreState() {
  return {
    owner: AWENIA_OWNER,
    anchor: AWENIA_ANCHOR,
    immutableRules,
    protectedFiles,
    protection: {
      active: true,
      highRiskRequiresApproval: true,
      lockedFilesBlocked: true,
      pathTraversalBlocked: true,
      truthClaimsRequireVerification: true,
      controlledByGabi: true,
      readStatusSeparatedFromExecution: true,
    },
    timestamp: now(),
  };
}

export const protectedCore = {
  owner: AWENIA_OWNER,
  anchor: AWENIA_ANCHOR,
  immutableRules,
  protectedFiles,
  getProtectedCoreState,
  getProtectedFiles,
  getImmutableRules,
  getProtectionLevel,
  isProtectedFile,
  isLockedFile,
  requiresApproval,
  requiresGabiApproval,
  validateCoreAction,
  validateSystemStatusClaim,
  canReadFile,
  canModifyFile,
  assertCanModifyFile,
};

export default protectedCore;