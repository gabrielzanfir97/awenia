import fs from "fs/promises";
import path from "path";

export type DevAgentRisk = "low" | "medium" | "high" | "critical";

export type DevAgentAction =
  | "read"
  | "write"
  | "patch"
  | "delete"
  | "rollback";

export type DevAgentValidation = {
  allowed: boolean;
  blocked: boolean;
  risk: DevAgentRisk;
  reason: string;
  normalizedPath: string;
  absolutePath: string;
  requiresApproval: boolean;
};

export type DevAgentFileInfo = {
  filePath: string;
  size: number;
  extension: string;
  modifiedAt: string;
};

export type DevAgentApprovalOptions = {
  approvedByGabi?: boolean;
  approvedBy?: string;
  pendingActionId?: string;
  reason?: string;
  source?: string;
};

export type DevAgentWriteResult = {
  success: boolean;
  action: "write";
  filePath: string;
  backupPath?: string;
  risk: DevAgentRisk;
  requiresApproval: boolean;
  approvedBy?: string;
  pendingActionId?: string | null;
  timestamp: string;
};

export type DevAgentPatchResult = {
  success: boolean;
  action: "patch";
  filePath: string;
  backupPath?: string;
  changed: boolean;
  risk: DevAgentRisk;
  requiresApproval: boolean;
  approvedBy?: string;
  pendingActionId?: string | null;
  reason?: string;
  matches?: number;
  timestamp: string;
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
  "app/protected-core.ts",
];

const ALLOWED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".md",
  ".txt",
  ".html",
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

function normalizeRulePath(filePath = "") {
  return normalizeProjectPath(filePath)
    .replace(/\/+$/, "")
    .toLowerCase();
}

function hasPathTraversal(filePath = "") {
  const normalized = normalizeProjectPath(filePath);

  return (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    path.isAbsolute(filePath) ||
    /^[a-zA-Z]:\//.test(normalized)
  );
}

function isInsideProjectRoot(absolutePath: string) {
  const relative = path.relative(PROJECT_ROOT, absolutePath);

  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function pathMatchesRule(filePath: string, rulePath: string) {
  const normalized = normalizeRulePath(filePath);
  const rule = normalizeRulePath(rulePath);

  if (!normalized || !rule) return false;

  const segments = normalized.split("/");

  if (rule.startsWith(".")) {
    return segments.some(
      (segment) =>
        segment === rule ||
        segment.startsWith(`${rule}.`)
    );
  }

  if (rule === "node_modules" || rule === ".git") {
    return segments.includes(rule);
  }

  return (
    normalized === rule ||
    normalized.startsWith(`${rule}/`) ||
    normalized.startsWith(`${rule}.`)
  );
}

function isBlockedPath(filePath: string) {
  return BLOCKED_PATHS.some((blocked) =>
    pathMatchesRule(filePath, blocked)
  );
}

function isHighRiskPath(filePath: string) {
  return HIGH_RISK_PATHS.some((risky) =>
    pathMatchesRule(filePath, risky)
  );
}

function getFileExtension(filePath: string) {
  return path.extname(filePath).toLowerCase();
}

function isAllowedExtension(filePath: string) {
  const extension = getFileExtension(filePath);

  if (!extension) return true;

  return ALLOWED_EXTENSIONS.includes(extension);
}

function resolveProjectPath(filePath: string) {
  const normalizedPath = normalizeProjectPath(filePath);
  const absolutePath = path.resolve(PROJECT_ROOT, normalizedPath || ".");

  if (!isInsideProjectRoot(absolutePath)) {
    throw new Error("Path is outside project root");
  }

  return {
    normalizedPath,
    absolutePath,
  };
}

function detectRisk(
  filePath: string,
  action: DevAgentAction
): DevAgentRisk {
  if (hasPathTraversal(filePath)) return "critical";
  if (isBlockedPath(filePath)) return "critical";
  if (action === "delete") return "critical";
  if (isHighRiskPath(filePath)) return "high";
  if (
    action === "write" ||
    action === "patch" ||
    action === "rollback"
  ) {
    return "medium";
  }

  return "low";
}

function assertWriteApproval(
  validation: DevAgentValidation,
  options?: DevAgentApprovalOptions
) {
  if (
    validation.requiresApproval &&
    options?.approvedByGabi !== true
  ) {
    throw new Error(
      "Dev-agent write/patch/rollback requires explicit Gabi approval through an approved pending action."
    );
  }
}

function countExactMatches(content: string, searchText: string) {
  if (!searchText) return 0;

  let count = 0;
  let index = 0;

  while (true) {
    const foundAt = content.indexOf(searchText, index);

    if (foundAt === -1) break;

    count += 1;
    index = foundAt + searchText.length;
  }

  return count;
}

export function validateProjectFilePath(
  filePath: string,
  action: DevAgentAction = "read"
): DevAgentValidation {
  const { normalizedPath, absolutePath } = resolveProjectPath(filePath);
  const risk = detectRisk(normalizedPath, action);

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

  if (!isAllowedExtension(normalizedPath)) {
    return {
      allowed: false,
      blocked: true,
      risk: "high",
      reason: "File extension is not allowed for dev-agent",
      normalizedPath,
      absolutePath,
      requiresApproval: true,
    };
  }

  return {
    allowed: true,
    blocked: false,
    risk,
    reason: "Path validated",
    normalizedPath,
    absolutePath,
    requiresApproval: risk !== "low",
  };
}

async function ensureParentDirectory(absolutePath: string) {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
}

async function fileExists(absolutePath: string) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function createFileBackup(filePath: string) {
  const validation = validateProjectFilePath(filePath, "read");

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const exists = await fileExists(validation.absolutePath);

  if (!exists) {
    return null;
  }

  const content = await fs.readFile(validation.absolutePath, "utf8");

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const backupPath = `${validation.absolutePath}.${timestamp}.backup`;
  const simpleBackupPath = `${validation.absolutePath}.backup`;

  await fs.writeFile(backupPath, content, "utf8");
  await fs.writeFile(simpleBackupPath, content, "utf8");

  return normalizeProjectPath(path.relative(PROJECT_ROOT, backupPath));
}

export async function readProjectFile(filePath: string) {
  const validation = validateProjectFilePath(filePath, "read");

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  return fs.readFile(validation.absolutePath, "utf8");
}

export async function writeProjectFile(
  filePath: string,
  content: string,
  options?: DevAgentApprovalOptions
): Promise<DevAgentWriteResult> {
  const validation = validateProjectFilePath(filePath, "write");

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  assertWriteApproval(validation, options);

  const backupPath = await createFileBackup(validation.normalizedPath);

  await ensureParentDirectory(validation.absolutePath);

  await fs.writeFile(validation.absolutePath, content, "utf8");

  return {
    success: true,
    action: "write",
    filePath: validation.normalizedPath,
    backupPath: backupPath || undefined,
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    approvedBy: options?.approvedBy || "Gabi",
    pendingActionId: options?.pendingActionId || null,
    timestamp: now(),
  };
}

export async function patchProjectFile(
  filePath: string,
  searchText: string,
  replacementText: string,
  options?: DevAgentApprovalOptions
): Promise<DevAgentPatchResult> {
  const validation = validateProjectFilePath(filePath, "patch");

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  assertWriteApproval(validation, options);

  const currentContent = await readProjectFile(validation.normalizedPath);
  const matches = countExactMatches(currentContent, searchText);

  if (matches === 0) {
    return {
      success: false,
      action: "patch",
      filePath: validation.normalizedPath,
      changed: false,
      risk: validation.risk,
      requiresApproval: validation.requiresApproval,
      approvedBy: options?.approvedBy || "Gabi",
      pendingActionId: options?.pendingActionId || null,
      reason: "Search text was not found in current file content",
      matches,
      timestamp: now(),
    };
  }

  if (matches > 1) {
    return {
      success: false,
      action: "patch",
      filePath: validation.normalizedPath,
      changed: false,
      risk: validation.risk,
      requiresApproval: validation.requiresApproval,
      approvedBy: options?.approvedBy || "Gabi",
      pendingActionId: options?.pendingActionId || null,
      reason: "Search text appears multiple times; patch is ambiguous",
      matches,
      timestamp: now(),
    };
  }

  const backupPath = await createFileBackup(validation.normalizedPath);

  const newContent = currentContent.replace(searchText, replacementText);

  await fs.writeFile(validation.absolutePath, newContent, "utf8");

  return {
    success: true,
    action: "patch",
    filePath: validation.normalizedPath,
    backupPath: backupPath || undefined,
    changed: true,
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    approvedBy: options?.approvedBy || "Gabi",
    pendingActionId: options?.pendingActionId || null,
    reason: "Patch applied after exact single match validation",
    matches,
    timestamp: now(),
  };
}

export async function rollbackProjectFile(
  filePath: string,
  options?: DevAgentApprovalOptions
) {
  const validation = validateProjectFilePath(filePath, "rollback");

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  assertWriteApproval(validation, options);

  const backupPath = `${validation.absolutePath}.backup`;

  const exists = await fileExists(backupPath);

  if (!exists) {
    throw new Error(`No backup found for ${validation.normalizedPath}`);
  }

  const beforeRollbackBackup = await createFileBackup(
    validation.normalizedPath
  );

  const backupContent = await fs.readFile(backupPath, "utf8");

  await fs.writeFile(validation.absolutePath, backupContent, "utf8");

  return {
    success: true,
    action: "rollback",
    filePath: validation.normalizedPath,
    backupPath: normalizeProjectPath(path.relative(PROJECT_ROOT, backupPath)),
    beforeRollbackBackup,
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    approvedBy: options?.approvedBy || "Gabi",
    pendingActionId: options?.pendingActionId || null,
    timestamp: now(),
  };
}

async function walkDirectory(
  directoryPath: string,
  basePath = ""
): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const absoluteEntryPath = path.join(directoryPath, entry.name);
    const relativeEntryPath = normalizeProjectPath(
      path.join(basePath, entry.name)
    );

    const lowerRelative = relativeEntryPath.toLowerCase();
    const parts = lowerRelative.split("/");

    if (
      parts.includes("node_modules") ||
      parts.includes(".git") ||
      parts.includes(".next")
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      const nestedFiles = await walkDirectory(
        absoluteEntryPath,
        relativeEntryPath
      );

      files.push(...nestedFiles);
    } else {
      if (isAllowedExtension(relativeEntryPath)) {
        files.push(relativeEntryPath);
      }
    }
  }

  return files;
}

export async function listProjectFiles(startDirectory = "app") {
  const validation = validateProjectFilePath(startDirectory, "read");

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const exists = await fileExists(validation.absolutePath);

  if (!exists) return [];

  const stat = await fs.stat(validation.absolutePath);

  if (stat.isFile()) {
    return [validation.normalizedPath];
  }

  return walkDirectory(
    validation.absolutePath,
    validation.normalizedPath === "." ? "" : validation.normalizedPath
  );
}

export async function listProjectFilesDetailed(
  startDirectory = "app"
): Promise<DevAgentFileInfo[]> {
  const files = await listProjectFiles(startDirectory);

  const result: DevAgentFileInfo[] = [];

  for (const filePath of files) {
    const validation = validateProjectFilePath(filePath, "read");

    const stat = await fs.stat(validation.absolutePath);

    result.push({
      filePath,
      size: stat.size,
      extension: getFileExtension(filePath),
      modifiedAt: stat.mtime.toISOString(),
    });
  }

  return result;
}

export async function getProjectFileSnapshot(filePath: string) {
  const validation = validateProjectFilePath(filePath, "read");

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const exists = await fileExists(validation.absolutePath);

  if (!exists) {
    return {
      exists: false,
      filePath: validation.normalizedPath,
      risk: validation.risk,
      requiresApproval: validation.requiresApproval,
      timestamp: now(),
    };
  }

  const stat = await fs.stat(validation.absolutePath);
  const content = await fs.readFile(validation.absolutePath, "utf8");

  return {
    exists: true,
    filePath: validation.normalizedPath,
    size: stat.size,
    extension: getFileExtension(validation.normalizedPath),
    modifiedAt: stat.mtime.toISOString(),
    preview: content.slice(0, 2000),
    lineCount: content.split("\n").length,
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    timestamp: now(),
  };
}

export async function analyzeProjectFileSafety(filePath: string) {
  const readValidation = validateProjectFilePath(filePath, "read");
  const writeValidation = validateProjectFilePath(filePath, "write");

  return {
    filePath: readValidation.normalizedPath,
    canRead: readValidation.allowed,
    canWrite: writeValidation.allowed,
    canWriteWithoutApproval:
      writeValidation.allowed && !writeValidation.requiresApproval,
    canWriteWithApproval:
      writeValidation.allowed && writeValidation.requiresApproval,
    readRisk: readValidation.risk,
    writeRisk: writeValidation.risk,
    requiresApproval: writeValidation.requiresApproval,
    blocked: readValidation.blocked || writeValidation.blocked,
    reasons: [readValidation.reason, writeValidation.reason],
    timestamp: now(),
  };
}

export async function searchProjectFiles(
  query: string,
  startDirectory = "app"
) {
  const files = await listProjectFiles(startDirectory);
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) return [];

  return files.filter((filePath) =>
    filePath.toLowerCase().includes(lowerQuery)
  );
}

export async function searchInsideProjectFiles(
  query: string,
  startDirectory = "app",
  limit = 20
) {
  const files = await listProjectFiles(startDirectory);
  const lowerQuery = query.toLowerCase().trim();
  const matches: any[] = [];

  if (!lowerQuery) return [];

  for (const filePath of files) {
    if (matches.length >= limit) break;

    try {
      const content = await readProjectFile(filePath);
      const lowerContent = content.toLowerCase();
      const foundAt = lowerContent.indexOf(lowerQuery);

      if (foundAt !== -1) {
        matches.push({
          filePath,
          preview: content.slice(
            Math.max(0, foundAt - 200),
            foundAt + 500
          ),
        });
      }
    } catch {
      continue;
    }
  }

  return matches;
}

export async function getDevAgentState() {
  const files = await listProjectFiles("app");

  return {
    status: "active",
    projectRoot: PROJECT_ROOT,
    fileCount: files.length,
    blockedPaths: BLOCKED_PATHS,
    highRiskPaths: HIGH_RISK_PATHS,
    allowedExtensions: ALLOWED_EXTENSIONS,
    rules: {
      blocksEnvFiles: true,
      blocksGit: true,
      blocksNodeModules: true,
      blocksPathTraversal: true,
      createsBackupsBeforeWrite: true,
      requiresExplicitGabiApprovalForWritePatchRollback: true,
      rejectsAmbiguousPatches: true,
      requiresApprovalForMediumHighCriticalRisk: true,
    },
    truthPolicy: {
      readOperationsDoNotModifyFiles: true,
      writePatchRollbackRequireApproval: true,
      backupsCreatedBeforeWritePatchRollback: true,
    },
    timestamp: now(),
  };
}

export const readRealFile = readProjectFile;
export const writeRealFile = writeProjectFile;
export const patchRealFile = patchProjectFile;
export const rollbackRealFile = rollbackProjectFile;