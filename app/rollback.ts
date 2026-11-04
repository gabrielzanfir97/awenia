import fs from "fs/promises";
import path from "path";
import { existsSync, lstatSync } from "node:fs";

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

const PROJECT_ROOT = path.resolve(process.cwd());
const BACKUP_ROOT = path.resolve(
  process.env.USERPROFILE || path.dirname(PROJECT_ROOT),
  "Awenia-Backups"
);

function resolveExternalBackupBasePath(projectFilePath: string) {
  const absolutePath = path.resolve(BACKUP_ROOT, projectFilePath);
  const relative = path.relative(BACKUP_ROOT, absolutePath);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Backup path is outside the dedicated backup directory");
  }
  return absolutePath;
}

function assertSafeBackupPath(absolutePath: string) {
  // Verify existing directory components and files without following symlinks.
  const filesystemRoot = path.parse(absolutePath).root;
  let current = filesystemRoot;
  for (const part of path.relative(filesystemRoot, absolutePath).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stats = lstatSync(current);
      if (stats.isSymbolicLink()) {
        throw new Error("Symbolic links are not allowed in backup paths");
      }
      if (current === absolutePath ? !stats.isFile() : !stats.isDirectory()) {
        throw new Error("Unexpected file type in backup path");
      }
    } catch (error: any) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
}

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
  if (!target.allowed) throw new Error(target.reason);

  const externalBase = resolveExternalBackupBasePath(target.normalizedPath);
  const targetBaseName = path.basename(target.absolutePath);

  if (!backupFilePath) {
    const externalLatest = `${externalBase}.backup`;
    const legacyLatest = `${target.absolutePath}.backup`;
    const selected = existsSync(externalLatest) ? externalLatest : legacyLatest;
    assertSafeBackupPath(selected);
    return selected;
  }

  // Accept a backup from exactly the target's external or legacy directory.
  // The absolute external paths produced by dev-agent and listBackups are valid.
  const candidate = path.resolve(PROJECT_ROOT, String(backupFilePath).trim());
  const directory = path.dirname(candidate);
  if (
    directory !== path.dirname(externalBase) &&
    directory !== path.dirname(target.absolutePath)
  ) {
    throw new Error("Backup path is not in an allowed directory for this file");
  }

  const name = path.basename(candidate);
  if (
    name !== `${targetBaseName}.backup` &&
    !(name.startsWith(`${targetBaseName}.`) && name.endsWith(".backup"))
  ) {
    throw new Error("Backup does not belong to the selected project file");
  }

  assertSafeBackupPath(candidate);
  return candidate;
}

export async function createRollbackPoint(
  filePath: string,
  label = "manual"
) {
  const validation = validateRollbackPath(filePath);
  if (!validation.allowed) throw new Error(validation.reason);
  if (!(await fileExists(validation.absolutePath))) {
    throw new Error(`File does not exist: ${validation.normalizedPath}`);
  }

  const content = await fs.readFile(validation.absolutePath, "utf8");
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uniqueSuffix = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  const backupBase = resolveExternalBackupBasePath(validation.normalizedPath);
  const timestampedBackupPath = `${backupBase}.${safeLabel}.${timestamp}.${uniqueSuffix}.backup`;
  const latestBackupPath = `${backupBase}.backup`;

  assertSafeBackupPath(timestampedBackupPath);
  assertSafeBackupPath(latestBackupPath);
  await fs.mkdir(path.dirname(backupBase), { recursive: true });
  assertSafeBackupPath(timestampedBackupPath);
  assertSafeBackupPath(latestBackupPath);
  await fs.writeFile(timestampedBackupPath, content, { encoding: "utf8", flag: "wx" });
  await fs.writeFile(latestBackupPath, content, "utf8");
  const stat = await fs.stat(timestampedBackupPath);

  return {
    success: true,
    filePath: validation.normalizedPath,
    backupPath: timestampedBackupPath,
    latestBackupPath,
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
  if (!validation.allowed) throw new Error(validation.reason);

  const targetBaseName = path.basename(validation.absolutePath);
  const externalDirectory = path.dirname(
    resolveExternalBackupBasePath(validation.normalizedPath)
  );
  const legacyDirectory = path.dirname(validation.absolutePath);
  const backups: RollbackBackupInfo[] = [];

  // Until the old copies are safely migrated, show BOTH locations.
  for (const directory of [externalDirectory, legacyDirectory]) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error: any) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (
        name !== `${targetBaseName}.backup` &&
        !(name.startsWith(`${targetBaseName}.`) && name.endsWith(".backup"))
      ) continue;

      const absoluteBackupPath = path.join(directory, name);
      assertSafeBackupPath(absoluteBackupPath);
      const stat = await fs.stat(absoluteBackupPath);
      backups.push({
        filePath: validation.normalizedPath,
        backupPath: directory === externalDirectory
          ? absoluteBackupPath
          : normalizeProjectPath(path.relative(PROJECT_ROOT, absoluteBackupPath)),
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }

  return backups.sort(
    (a, b) =>
      new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
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

  // Save the selected backup before createRollbackPoint overwrites .backup.
  const backupContent = await fs.readFile(backupAbsolutePath, "utf8");

  const beforeRollbackBackup = await createRollbackPoint(
    validation.normalizedPath,
    "before_rollback"
  );

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