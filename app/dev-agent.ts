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

const PROJECT_ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd());
const BACKUP_ROOT = path.resolve(
  process.env.USERPROFILE || path.dirname(PROJECT_ROOT),
  "Awenia-Backups"
);
const MAX_SEARCH_FILE_BYTES = 2 * 1024 * 1024;

const READ_BLOCKED_PATHS = [
  ".env",
  ".env.local",
  ".git",
  "node_modules",
  ".next",
];

const WRITE_BLOCKED_PATHS = [
  ".env",
  ".env.local",
  ".git",
  "node_modules",
  ".next",
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
  "app/code-tools-handler.ts",
  "app/patch-generator.ts",
  "app/rollback.ts",
  "app/code-memory.ts",
  "app/system-tools-handler.ts",
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
  const raw = String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .trim();
  if (!raw) return "";

  // Canonicalize repeated ./ and internal /./ segments before matching rules.
  // This prevents equivalent paths from bypassing protected-file checks.
  const canonicalPath: string = path.posix.normalize(raw);
  return canonicalPath.replace(/^\/+/, "").replace(/^\.\//, "");
}

function normalizeRulePath(filePath = "") {
  return normalizeProjectPath(filePath)
    .replace(/\/+$/, "")
    .toLowerCase();
}

function hasPathTraversal(filePath = "") {
  const raw = String(filePath || "").trim();
  const slashPath = raw.replace(/\\/g, "/");
  const parts = slashPath.split("/");

  return (
    raw.includes("\0") ||
    raw.startsWith("/") ||
    slashPath.startsWith("/") ||
    /^[a-zA-Z]:/.test(slashPath) ||
    path.isAbsolute(raw) ||
    parts.includes("..")
  );
}

function isInsideProjectRoot(absolutePath: string) {
  const relative = path.relative(PROJECT_ROOT, absolutePath);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function pathMatchesRule(filePath: string, rulePath: string) {
  const normalized = normalizeRulePath(filePath);
  const rule = normalizeRulePath(rulePath);
  if (!normalized || !rule) return false;

  const segments = normalized.split("/");
  if (rule.startsWith(".")) {
    // Includes .env.local, .env.production, .gitignore, etc.
    return segments.some((segment) => segment === rule || segment.startsWith(`${rule}.`));
  }

  if (rule === "node_modules") return segments.includes(rule);
  return normalized === rule || normalized.startsWith(`${rule}/`);
}

function isBlockedPath(filePath: string, action: DevAgentAction) {
  const blockedPaths =
    action === "read" ? READ_BLOCKED_PATHS : WRITE_BLOCKED_PATHS;

  return blockedPaths.some((blocked) =>
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
  return { normalizedPath, absolutePath };
}

function detectRisk(
  filePath: string,
  action: DevAgentAction
): DevAgentRisk {
  if (hasPathTraversal(filePath)) return "critical";
  if (isBlockedPath(filePath, action)) return "critical";
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
  if (!validation.allowed) throw new Error(validation.reason);

  // The code tool handler checks the persisted approval before it calls dev-agent.
  // This also rejects accidental direct calls without an approval context.
  if (
    options?.approvedByGabi !== true ||
    options?.approvedBy !== "Gabi" ||
    !String(options?.pendingActionId || "").trim()
  ) {
    throw new Error(
      "Write/patch/rollback requires Gabi approval and an approved pending action ID."
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

  const blocked = (reason: string, risk: DevAgentRisk = "critical") => ({
    allowed: false,
    blocked: true,
    risk,
    reason,
    normalizedPath,
    absolutePath,
    requiresApproval: true,
  });

  if (!normalizedPath) return blocked("Missing file path");
  if (hasPathTraversal(filePath) || !isInsideProjectRoot(absolutePath)) {
    return blocked("Absolute paths and path traversal are blocked");
  }
  if (action === "delete") return blocked("Delete operations are disabled");
  if (action !== "read" && normalizedPath === ".") {
    return blocked("Cannot modify the project root directory");
  }
  if (isBlockedPath(normalizedPath, action)) {
    return blocked(
      action === "read"
        ? "Protected path cannot be read"
        : "Protected path cannot be modified"
    );
  }
  if (!isAllowedExtension(normalizedPath)) {
    return blocked("File extension is not allowed for dev-agent", "high");
  }

  const risk = detectRisk(normalizedPath, action);
  return {
    allowed: true,
    blocked: false,
    risk,
    reason: "Path validated",
    normalizedPath,
    absolutePath,
    requiresApproval: action !== "read",
  };
}

/** Reject symlinks in every existing path component (files AND directories). */
async function assertNoSymlinkPath(absolutePath: string) {
  if (!isInsideProjectRoot(absolutePath)) {
    throw new Error("Path outside project root");
  }

  const relative = path.relative(PROJECT_ROOT, absolutePath);
  let current = PROJECT_ROOT;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stats = await fs.lstat(current);
      if (stats.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in project file paths: ${part}`);
      }
    } catch (error: any) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
}

function resolveBackupBasePath(projectFilePath: string) {
  const backupBasePath = path.resolve(BACKUP_ROOT, projectFilePath);
  const relative = path.relative(BACKUP_ROOT, backupBasePath);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Backup path is outside the dedicated backup directory");
  }
  return backupBasePath;
}

async function assertSafeBackupTarget(backupPath: string) {
  const relative = path.relative(BACKUP_ROOT, backupPath);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Backup target is outside the dedicated backup directory");
  }

  // Inspect every existing path component: never follow directory symlinks.
  let current = path.parse(BACKUP_ROOT).root;
  for (const part of path.relative(current, backupPath).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stats = await fs.lstat(current);
      if (stats.isSymbolicLink()) {
        throw new Error("Symbolic links are not allowed in backup paths");
      }
      if (current === backupPath ? !stats.isFile() : !stats.isDirectory()) {
        throw new Error("Backup path contains an unexpected file type");
      }
    } catch (error: any) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
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
  if (!validation.allowed) throw new Error(validation.reason);
  await assertNoSymlinkPath(validation.absolutePath);
  if (!(await fileExists(validation.absolutePath))) return null;

  const stats = await fs.stat(validation.absolutePath);
  if (!stats.isFile()) throw new Error("Cannot back up a directory");
  const content = await fs.readFile(validation.absolutePath, "utf8");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uniqueSuffix = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  const backupBasePath = resolveBackupBasePath(validation.normalizedPath);
  const archivePath = `${backupBasePath}.${timestamp}.${uniqueSuffix}.backup`;
  const latestBackupPath = `${backupBasePath}.backup`;

  await assertSafeBackupTarget(archivePath);
  await assertSafeBackupTarget(latestBackupPath);
  await fs.mkdir(path.dirname(backupBasePath), { recursive: true });
  await assertSafeBackupTarget(archivePath);
  await assertSafeBackupTarget(latestBackupPath);
  await fs.writeFile(archivePath, content, { encoding: "utf8", flag: "wx" });
  await fs.writeFile(latestBackupPath, content, "utf8");

  return archivePath;
}

export async function readProjectFile(filePath: string) {
  const validation = validateProjectFilePath(filePath, "read");
  if (!validation.allowed) throw new Error(validation.reason);
  await assertNoSymlinkPath(validation.absolutePath);

  const stats = await fs.stat(validation.absolutePath);
  if (!stats.isFile()) throw new Error("Expected a regular project file");
  return fs.readFile(validation.absolutePath, "utf8");
}

export async function writeProjectFile(
  filePath: string,
  content: string,
  options?: DevAgentApprovalOptions
): Promise<DevAgentWriteResult> {
  const validation = validateProjectFilePath(filePath, "write");
  assertWriteApproval(validation, options);
  await assertNoSymlinkPath(validation.absolutePath);

  const backupPath = await createFileBackup(validation.normalizedPath);
  await ensureParentDirectory(validation.absolutePath);
  await assertNoSymlinkPath(validation.absolutePath);
  await fs.writeFile(validation.absolutePath, content, "utf8");

  return {
    success: true,
    action: "write",
    filePath: validation.normalizedPath,
    backupPath: backupPath || undefined,
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    approvedBy: options?.approvedBy,
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
  assertWriteApproval(validation, options);
  await assertNoSymlinkPath(validation.absolutePath);

  const currentContent = await readProjectFile(validation.normalizedPath);
  const matches = countExactMatches(currentContent, searchText);
  if (!searchText || matches !== 1 || searchText === replacementText) {
    let reason = "Patch would not change the file";
    if (!searchText) reason = "Missing SEARCH text";
    else if (matches === 0) reason = "SEARCH text not found in current file";
    else if (matches > 1) reason = "SEARCH text is ambiguous (multiple matches)";

    return {
      success: false,
      action: "patch",
      filePath: validation.normalizedPath,
      changed: false,
      risk: validation.risk,
      requiresApproval: validation.requiresApproval,
      approvedBy: options?.approvedBy,
      pendingActionId: options?.pendingActionId || null,
      reason,
      matches,
      timestamp: now(),
    };
  }

  const backupPath = await createFileBackup(validation.normalizedPath);
  const newContent = currentContent.replace(searchText, replacementText);
  await assertNoSymlinkPath(validation.absolutePath);
  await fs.writeFile(validation.absolutePath, newContent, "utf8");

  return {
    success: true,
    action: "patch",
    filePath: validation.normalizedPath,
    backupPath: backupPath || undefined,
    changed: true,
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    approvedBy: options?.approvedBy,
    pendingActionId: options?.pendingActionId || null,
    reason: "Exactly one SEARCH match, patch applied after approval",
    matches,
    timestamp: now(),
  };
}

export async function rollbackProjectFile(
  filePath: string,
  options?: DevAgentApprovalOptions
) {
  const validation = validateProjectFilePath(filePath, "rollback");
  assertWriteApproval(validation, options);
  await assertNoSymlinkPath(validation.absolutePath);

  const externalBackupPath = `${resolveBackupBasePath(validation.normalizedPath)}.backup`;
  const legacyBackupPath = `${validation.absolutePath}.backup`;
  const useExternal = await fileExists(externalBackupPath);
  const latestBackupPath = useExternal ? externalBackupPath : legacyBackupPath;
  if (useExternal) {
    await assertSafeBackupTarget(latestBackupPath);
  } else {
    // Keep older in-project backups available until they have been migrated.
    await assertNoSymlinkPath(latestBackupPath);
    if (await fileExists(latestBackupPath)) {
      const stats = await fs.lstat(latestBackupPath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error("Legacy backup is not a safe regular file");
      }
    }
  }
  if (!(await fileExists(latestBackupPath))) {
    throw new Error(`No backup found for ${validation.normalizedPath}`);
  }

  // Read the version to restore FIRST. createFileBackup also updates .backup.
  const restoreContent = await fs.readFile(latestBackupPath, "utf8");
  const currentContent = await readProjectFile(validation.normalizedPath);
  if (currentContent === restoreContent) {
    throw new Error("Rollback not needed: current file already matches the backup");
  }

  // Archive the current version before writing the restored one. The latest
  // .backup becomes the pre-rollback version for a future reversible rollback.
  const beforeRollbackBackup = await createFileBackup(validation.normalizedPath);
  await assertNoSymlinkPath(validation.absolutePath);
  await fs.writeFile(validation.absolutePath, restoreContent, "utf8");

  return {
    success: true,
    action: "rollback" as const,
    filePath: validation.normalizedPath,
    backupPath: latestBackupPath,
    beforeRollbackBackup,
    risk: validation.risk,
    requiresApproval: validation.requiresApproval,
    approvedBy: options?.approvedBy,
    pendingActionId: options?.pendingActionId || null,
    timestamp: now(),
  };
}

async function walkDirectory(
  directoryPath: string,
  basePath = ""
): Promise<string[]> {
  await assertNoSymlinkPath(directoryPath);
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absoluteEntryPath = path.join(directoryPath, entry.name);
    const relativeEntryPath = normalizeProjectPath(path.join(basePath, entry.name));
    const segments = relativeEntryPath.toLowerCase().split("/");

    if (
      segments.includes("node_modules") ||
      segments.includes(".git") ||
      segments.includes(".next") ||
      isBlockedPath(relativeEntryPath, "read") ||
      entry.name.toLowerCase().endsWith(".backup")
    ) continue;

    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(absoluteEntryPath, relativeEntryPath)));
    } else if (entry.isFile() && isAllowedExtension(relativeEntryPath)) {
      files.push(relativeEntryPath);
    }
  }

  return files;
}

export async function listProjectFiles(startDirectory = "app") {
  const validation = validateProjectFilePath(startDirectory, "read");
  if (!validation.allowed) throw new Error(validation.reason);
  await assertNoSymlinkPath(validation.absolutePath);
  if (!(await fileExists(validation.absolutePath))) return [];

  const stats = await fs.stat(validation.absolutePath);
  if (stats.isFile()) return [validation.normalizedPath];
  if (!stats.isDirectory()) return [];
  const files = await walkDirectory(
    validation.absolutePath,
    validation.normalizedPath === "." ? "" : validation.normalizedPath
  );
  return files.sort((a, b) => a.localeCompare(b));
}

export async function listProjectFilesDetailed(
  startDirectory = "app"
): Promise<DevAgentFileInfo[]> {
  const files = await listProjectFiles(startDirectory);

  const result: DevAgentFileInfo[] = [];

  for (const filePath of files) {
    try {
      const validation = validateProjectFilePath(filePath, "read");

      if (!validation.allowed) continue;

      const stat = await fs.stat(validation.absolutePath);

      result.push({
        filePath,
        size: stat.size,
        extension: getFileExtension(filePath),
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch {
      continue;
    }
  }

  return result;
}

export async function getProjectFileSnapshot(filePath: string) {
  const validation = validateProjectFilePath(filePath, "read");
  if (!validation.allowed) throw new Error(validation.reason);
  await assertNoSymlinkPath(validation.absolutePath);
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

  const stats = await fs.stat(validation.absolutePath);
  if (!stats.isFile()) throw new Error("Expected a regular project file");
  const content = await fs.readFile(validation.absolutePath, "utf8");
  return {
    exists: true,
    filePath: validation.normalizedPath,
    size: stats.size,
    extension: getFileExtension(validation.normalizedPath),
    modifiedAt: stats.mtime.toISOString(),
    preview: content.slice(0, 2000),
    lineCount: content.replace(/\r\n/g, "\n").split("\n").length,
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
    canWriteWithoutApproval: false,
    canWriteWithApproval: writeValidation.allowed && writeValidation.requiresApproval,
    readRisk: readValidation.risk,
    writeRisk: writeValidation.risk,
    requiresApproval: writeValidation.requiresApproval,
    // `blocked` describes read-access: a protected file may be readable but not writable.
    blocked: readValidation.blocked,
    readBlocked: readValidation.blocked,
    writeBlocked: writeValidation.blocked,
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
  const lowerQuery = String(query || "").toLowerCase().trim();
  const matches: { filePath: string; preview: string }[] = [];
  if (!lowerQuery) return matches;

  for (const filePath of files) {
    if (matches.length >= limit) break;
    try {
      const validation = validateProjectFilePath(filePath, "read");
      if (!validation.allowed) continue;
      await assertNoSymlinkPath(validation.absolutePath);
      const stat = await fs.stat(validation.absolutePath);
      if (!stat.isFile() || stat.size > MAX_SEARCH_FILE_BYTES) continue;
      const content = await fs.readFile(validation.absolutePath, "utf8");
      const foundAt = content.toLowerCase().indexOf(lowerQuery);
      if (foundAt !== -1) {
        matches.push({
          filePath,
          preview: content.slice(Math.max(0, foundAt - 200), foundAt + 500),
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
    readBlockedPaths: READ_BLOCKED_PATHS,
    writeBlockedPaths: WRITE_BLOCKED_PATHS,
    highRiskPaths: HIGH_RISK_PATHS,
    allowedExtensions: ALLOWED_EXTENSIONS,
    rules: {
      blocksEnvFiles: true,
      blocksGit: true,
      blocksNodeModules: true,
      blocksPathTraversal: true,
      blocksSymlinks: true,
      protectedCoreCanBeReadButNotModified: true,
      createsBackupsBeforeWrite: true,
      requiresExplicitGabiApprovalForWritePatchRollback: true,
      requiresPendingActionIdForWritePatchRollback: true,
      rejectsAmbiguousPatches: true,
      requiresApprovalForMediumHighCriticalRisk: true,
      rollbackPreservesVersionToRestore: true,
    },
    truthPolicy: {
      readOperationsDoNotModifyFiles: true,
      writePatchRollbackRequireApproval: true,
      backupsCreatedBeforeWritePatchRollback: true,
      approvalStatusCheckedByCallingHandler: true,
    },
    timestamp: now(),
  };
}

export const readRealFile = readProjectFile;
export const writeRealFile = writeProjectFile;
export const patchRealFile = patchProjectFile;
export const rollbackRealFile = rollbackProjectFile;