import fs from "fs/promises";
import path from "path";

export type RollbackRisk = "low" | "medium" | "high" | "critical";

export type RollbackValidation = {
  allowed: boolean;
  blocked: boolean;
  risk: RollbackRisk;
  reason: string;
  normalizedPath: string;
  absolutePath: string;
  requiresApproval: boolean;
};

export type RollbackBackupInfo = {
  filePath: string;
  backupPath: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
};

export type RollbackApprovalOptions = {
  approvedByGabi?: boolean;
  approvedBy?: string;
  pendingActionId?: string;
  reason?: string;
};

const PROJECT_ROOT = process.cwd();

const BLOCKED_PATHS = [
  ".env",
  ".env.local",
  ".git",
  "node_modules",
  "app/protected-core.ts",
];

const HIGH_RISK_PATHS = [
  "app/api/",
  "app/api/awenia/route.ts",
  "app/memory-store.ts",
  "app/supabase.ts",
  "app/dev-agent.ts",
  "app/pending-actions.ts",
  "app/security.ts",
];

function now() {
  return new Date().toISOString();
}

function normalizeProjectPath(filePath = "") {
  return String(filePath)
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .trim();
}

function normalizeAbsolutePath(absolutePath: string) {
  return path.resolve(absolutePath);
}

function isInsideProjectRoot(absolutePath: string) {
  const relative = path.relative(PROJECT_ROOT, absolutePath);

  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function hasPathTraversal(filePath: string) {
  const normalized = normalizeProjectPath(filePath);

  return (
    !normalized ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    path.isAbsolute(filePath)
  );
}

function resolveProjectPath(filePath: string) {
  const normalizedPath = normalizeProjectPath(filePath);

  if (!normalizedPath) {
    return {
      normalizedPath,
      absolutePath: PROJECT_ROOT,
    };
  }

  const absolutePath = normalizeAbsolutePath(
    path.resolve(PROJECT_ROOT, normalizedPath)
  );

  if (!isInsideProjectRoot(absolutePath)) {
    throw new Error("Path is outside project root");
  }

  return {
    normalizedPath,
    absolutePath,
  };
}

function pathMatchesMarker(filePath: string, marker: string) {
  const normalized = normalizeProjectPath(filePath).toLowerCase();
  const normalizedMarker = normalizeProjectPath(marker).toLowerCase();

  return (
    normalized === normalizedMarker ||
    normalized.startsWith(`${normalizedMarker}/`) ||
    normalized.includes(`/${normalizedMarker}/`) ||
    normalized.includes(normalizedMarker)
  );
}

function isBlockedPath(filePath: string) {
  const normalized = normalizeProjectPath(filePath).toLowerCase();

  return BLOCKED_PATHS.some((blocked) =>
    pathMatchesMarker(normalized, blocked)
  );
}

function isHighRiskPath(filePath: string) {
  const normalized = normalizeProjectPath(filePath).toLowerCase();

  return HIGH_RISK_PATHS.some((risky) =>
    pathMatchesMarker(normalized, risky)
  );
}

function detectRisk(filePath: string): RollbackRisk {
  if (hasPathTraversal(filePath)) return "critical";
  if (isBlockedPath(filePath)) return "critical";
  if (isHighRiskPath(filePath)) return "high";

  return "medium";
}

async function fileExists(absolutePath: string) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function requireRollbackApproval(options?: RollbackApprovalOptions) {
  if (!options?.approvedByGabi) {
    return {
      approved: false,
      reason:
        "Rollback execution requires explicit Gabi approval. Use an approved pending action flow before calling rollbackFile.",
    };
  }

  return {
    approved: true,
    reason: "Rollback approved by Gabi",
  };
}

export function validateRollbackPath(filePath: string): RollbackValidation {
  const { normalizedPath, absolutePath } = resolveProjectPath(filePath);
  const risk = detectRisk(normalizedPath);

  if (!normalizedPath) {
    return {
      allowed: false,
      blocked: true,
      risk: "critical",
      reason: "Missing file path",
      normalizedPath,
      absolutePath,
      requiresApproval: true,
    };
  }

  if (hasPathTraversal(normalizedPath)) {
    return {
      allowed: false,
      blocked: true,
      risk: "critical",
      reason: "Path traversal is blocked",
      normalizedPath,
      absolutePath,
      requiresApproval: true,
    };
  }

  if (isBlockedPath(normalizedPath)) {
    return {
      allowed: false,
      blocked: true,
      risk: "critical",
      reason: "Protected path is blocked",
      normalizedPath,
      absolutePath,
      requiresApproval: true,
    };
  }

  return {
    allowed: risk !== "critical",
    blocked: risk === "critical",
    risk,
    reason:
      risk === "critical"
        ? "Critical rollback path is blocked"
        : "Rollback path validated",
    normalizedPath,
    absolutePath,
    requiresApproval: true,
  };
}

function resolveBackupPath(targetFilePath: string, backupFilePath?: string) {
  const target = validateRollbackPath(targetFilePath);

  if (!target.allowed) {
    throw new Error(target.reason);
  }

  if (!backupFilePath) {
    return `${target.absolutePath}.backup`;
  }

  const backupNormalized = normalizeProjectPath(backupFilePath);
  const backupAbsolute = normalizeAbsolutePath(
    path.resolve(PROJECT_ROOT, backupNormalized)
  );

  if (!isInsideProjectRoot(backupAbsolute)) {
    throw new Error("Backup path is outside project root");
  }

  if (!backupNormalized.endsWith(".backup")) {
    throw new Error("Backup file must end with .backup");
  }

  const targetBaseName = path.basename(target.absolutePath);
  const backupBaseName = path.basename(backupAbsolute);

  if (
    backupBaseName !== `${targetBaseName}.backup` &&
    !backupBaseName.startsWith(`${targetBaseName}.`)
  ) {
    throw new Error("Backup does not appear to belong to target file");
  }

  return backupAbsolute;
}

export async function createRollbackPoint(
  filePath: string,
  label = "manual"
) {
  const validation = validateRollbackPath(filePath);

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const exists = await fileExists(validation.absolutePath);

  if (!exists) {
    throw new Error(`File does not exist: ${validation.normalizedPath}`);
  }

  const content = await fs.readFile(validation.absolutePath, "utf8");

  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const timestampedBackupPath = `${validation.absolutePath}.${safeLabel}.${timestamp}.backup`;
  const latestBackupPath = `${validation.absolutePath}.backup`;

  await fs.writeFile(timestampedBackupPath, content, "utf8");
  await fs.writeFile(latestBackupPath, content, "utf8");

  const stat = await fs.stat(timestampedBackupPath);

  return {
    success: true,
    filePath: validation.normalizedPath,
    backupPath: normalizeProjectPath(
      path.relative(PROJECT_ROOT, timestampedBackupPath)
    ),
    latestBackupPath: normalizeProjectPath(
      path.relative(PROJECT_ROOT, latestBackupPath)
    ),
    size: stat.size,
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    truthPolicy: {
      fileChanged: false,
      backupCreatedOnly: true,
    },
    timestamp: now(),
  };
}

export async function listRollbackBackups(filePath: string) {
  const validation = validateRollbackPath(filePath);

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const directory = path.dirname(validation.absolutePath);
  const targetBaseName = path.basename(validation.absolutePath);

  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  const backups: RollbackBackupInfo[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const isBackup =
      entry.name === `${targetBaseName}.backup` ||
      (entry.name.startsWith(`${targetBaseName}.`) &&
        entry.name.endsWith(".backup"));

    if (!isBackup) continue;

    const absoluteBackupPath = path.join(directory, entry.name);
    const stat = await fs.stat(absoluteBackupPath);

    backups.push({
      filePath: validation.normalizedPath,
      backupPath: normalizeProjectPath(
        path.relative(PROJECT_ROOT, absoluteBackupPath)
      ),
      size: stat.size,
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
    });
  }

  return backups.sort(
    (a, b) =>
      new Date(b.modifiedAt).getTime() -
      new Date(a.modifiedAt).getTime()
  );
}

export async function getLatestRollbackBackup(filePath: string) {
  const backups = await listRollbackBackups(filePath);

  return backups[0] || null;
}

export async function previewRollback(
  filePath: string,
  backupFilePath?: string
) {
  const validation = validateRollbackPath(filePath);

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const backupAbsolutePath = resolveBackupPath(
    validation.normalizedPath,
    backupFilePath
  );

  const backupExists = await fileExists(backupAbsolutePath);
  const targetExists = await fileExists(validation.absolutePath);

  if (!backupExists) {
    return {
      canRollback: false,
      reason: "Backup file not found",
      filePath: validation.normalizedPath,
      backupPath: normalizeProjectPath(
        path.relative(PROJECT_ROOT, backupAbsolutePath)
      ),
      risk: validation.risk,
      requiresApproval: true,
      truthPolicy: {
        fileChanged: false,
        previewOnly: true,
      },
      timestamp: now(),
    };
  }

  const currentContent = targetExists
    ? await fs.readFile(validation.absolutePath, "utf8")
    : "";

  const backupContent = await fs.readFile(backupAbsolutePath, "utf8");

  return {
    canRollback: true,
    filePath: validation.normalizedPath,
    backupPath: normalizeProjectPath(
      path.relative(PROJECT_ROOT, backupAbsolutePath)
    ),

    current: {
      exists: targetExists,
      lineCount: currentContent.split("\n").length,
      preview: currentContent.slice(0, 3000),
    },

    backup: {
      lineCount: backupContent.split("\n").length,
      preview: backupContent.slice(0, 3000),
    },

    risk: validation.risk,
    requiresApproval: true,
    truthPolicy: {
      fileChanged: false,
      previewOnly: true,
    },
    timestamp: now(),
  };
}

export async function rollbackFile(
  filePath: string,
  backupFilePath?: string,
  options?: RollbackApprovalOptions
) {
  const validation = validateRollbackPath(filePath);

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const approval = requireRollbackApproval(options);

  if (!approval.approved) {
    throw new Error(approval.reason);
  }

  const backupAbsolutePath = resolveBackupPath(
    validation.normalizedPath,
    backupFilePath
  );

  const backupExists = await fileExists(backupAbsolutePath);

  if (!backupExists) {
    throw new Error(`No backup found for ${validation.normalizedPath}`);
  }

  const beforeRollbackBackup = await createRollbackPoint(
    validation.normalizedPath,
    "before_rollback"
  );

  const backupContent = await fs.readFile(backupAbsolutePath, "utf8");

  await fs.writeFile(validation.absolutePath, backupContent, "utf8");

  return {
    success: true,
    action: "rollback",
    filePath: validation.normalizedPath,
    restoredFrom: normalizeProjectPath(
      path.relative(PROJECT_ROOT, backupAbsolutePath)
    ),
    beforeRollbackBackup,
    risk: validation.risk,
    requiresApproval: true,
    approvedBy: options?.approvedBy || "Gabi",
    pendingActionId: options?.pendingActionId || null,
    reason: options?.reason || "Approved rollback execution",
    truthPolicy: {
      fileChanged: true,
      executedOnlyWithExplicitApproval: true,
      backupCreatedBeforeRollback: true,
    },
    timestamp: now(),
  };
}

export async function restoreFileFromBackup(
  filePath: string,
  backupFilePath?: string,
  options?: RollbackApprovalOptions
) {
  return rollbackFile(filePath, backupFilePath, options);
}

export async function getRollbackState(filePath: string) {
  const validation = validateRollbackPath(filePath);
  const backups = validation.allowed
    ? await listRollbackBackups(validation.normalizedPath)
    : [];

  return {
    filePath: validation.normalizedPath,
    allowed: validation.allowed,
    blocked: validation.blocked,
    risk: validation.risk,
    reason: validation.reason,
    requiresApproval: validation.requiresApproval,
    backupCount: backups.length,
    latestBackup: backups[0] || null,
    backups,
    truthPolicy: {
      fileChanged: false,
      stateCheckOnly: true,
    },
    timestamp: now(),
  };
}

export const createBackup = createRollbackPoint;
export const listBackups = listRollbackBackups;
export const getLatestBackup = getLatestRollbackBackup;