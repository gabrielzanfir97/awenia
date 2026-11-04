import {
  listProjectFiles,
  listProjectFilesDetailed,
  readProjectFile,
  writeProjectFile,
  patchProjectFile,
  rollbackProjectFile,
  getProjectFileSnapshot,
  analyzeProjectFileSafety,
  validateProjectFilePath,
  searchProjectFiles,
  searchInsideProjectFiles,
} from "./dev-agent";

import {
  saveCodeMemory,
  setActiveCodeFile,
  extractImports,
  createSmartCodeSummary,
  detectFilePurpose,
  extractExports,
  extractFunctions,
  detectRiskLevel,
} from "./code-memory";

import {
  savePendingAction,
  analyzePendingActionRisk,
  getPendingActionById,
  canExecutePendingAction,
  completePendingAction,
  failPendingAction,
} from "./pending-actions";

import { createHash } from "node:crypto";

export type CodeToolStatus =
  | "completed"
  | "pending_approval"
  | "blocked"
  | "failed"
  | "needs_attention";

type PendingActionRecord = any;

function now() {
  return new Date().toISOString();
}

function jsonReply(data: any) {
  return JSON.stringify(data, null, 2);
}

function response(tool: string, status: CodeToolStatus, data: any) {
  return Response.json({
    reply: jsonReply(data),
    tool,
    status,
    data,
    timestamp: now(),
  });
}

function stripCommand(message: string, commands: string[]) {
  let cleaned = String(message || "").trim();
  const upper = cleaned.toUpperCase();

  for (const command of commands) {
    const base = command.replace(/:$/, "").trim();
    const upperBase = base.toUpperCase();

    if (
      upper === upperBase ||
      upper.startsWith(`${upperBase}:`) ||
      upper.startsWith(`${upperBase} `)
    ) {
      cleaned = cleaned.slice(base.length).trim();
      cleaned = cleaned.replace(/^:/, "").trim();
      return cleaned;
    }
  }

  return cleaned;
}

function normalizePath(filePath = "") {
  return String(filePath)
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function extractCodeBlock(text: string) {
  const raw = String(text || "").replace(/\r\n/g, "\n");
  const fenced = raw.match(/```[\w-]*\n([\s\S]*?)```/);

  // Preserve first-line indentation. Trimming it could corrupt TypeScript code.
  return (fenced?.[1] ?? raw).replace(/^\n/, "").replace(/\n$/, "");
}

function parsePathOnly(message: string, commands: string[]) {
  const cleaned = stripCommand(message, commands);
  return normalizePath(cleaned.split("\n")[0] || "");
}

function parsePathAndBody(message: string, commands: string[]) {
  const cleaned = stripCommand(message, commands);
  const lines = cleaned.split("\n");
  const filePath = normalizePath(lines.shift() || "");
  const body = extractCodeBlock(lines.join("\n"));

  return {
    filePath,
    body,
  };
}

function parseSearchReplaceBlocks(text: string) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const searchIndex = lines.findIndex((line) => /^\s*SEARCH:[ \t]*/i.test(line));
  const replaceIndex = lines.findIndex(
    (line, index) => index > searchIndex && /^\s*REPLACE:[ \t]*/i.test(line)
  );

  if (searchIndex < 0 || replaceIndex < 0) {
    return { searchText: "", replacementText: "" };
  }

  const searchFirst = lines[searchIndex].replace(/^\s*SEARCH:[ \t]*/i, "");
  const replaceFirst = lines[replaceIndex].replace(/^\s*REPLACE:[ \t]*/i, "");
  const searchLines = [...(searchFirst ? [searchFirst] : []), ...lines.slice(searchIndex + 1, replaceIndex)];
  const replaceLines = [...(replaceFirst ? [replaceFirst] : []), ...lines.slice(replaceIndex + 1)];

  // Remove one final transport newline; preserve indentation inside both blocks.
  const searchText = searchLines.join("\n").replace(/\n$/, "");
  const replacementText = replaceLines.join("\n").replace(/\n$/, "");

  return { searchText, replacementText };
}

function parsePatch(message: string) {
  const { filePath, body } = parsePathAndBody(message, [
    "PATCH_FILE",
    "PATCH_REAL_FILE",
    "GENERATE_PATCH",
    "CREATE_PATCH",
  ]);

  const blocks = parseSearchReplaceBlocks(body);

  return {
    filePath,
    patch: body,
    searchText: blocks.searchText,
    replacementText: blocks.replacementText,
  };
}

function parsePendingActionId(message: string, commands: string[]) {
  const cleaned = stripCommand(message, commands);
  const firstLine = cleaned.split("\n")[0]?.trim() || "";

  return firstLine
    .replace(/^ID:\s*/i, "")
    .replace(/^PENDING_ACTION_ID:\s*/i, "")
    .trim();
}

function getActionType(action: PendingActionRecord) {
  return String(action?.action_type || "").trim().toUpperCase();
}

function getActionId(action: PendingActionRecord) {
  return String(action?.id || action?.action?.id || "").trim();
}

function matchesCommand(message: string, command: string) {
  const input = String(message || "").trim().toUpperCase();
  const name = command.trim().toUpperCase();
  return input === name || input.startsWith(`${name}:`) || input.startsWith(`${name} `);
}

function hashContent(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function countOccurrences(content: string, text: string) {
  if (!text) return 0;
  return content.split(text).length - 1;
}

function checkPendingActionSaved(pendingAction: any) {
  const actionId = getActionId(pendingAction);
  const reportedFailure = pendingAction?.status === "failed" || pendingAction?.error;
  return { saved: Boolean(actionId) && !reportedFailure, actionId };
}

async function checkFilePrecondition(action: PendingActionRecord, filePath: string) {
  const metadata = action?.metadata || {};
  const expectedHash = metadata.expectedFileHash;
  const expectedExists = metadata.expectedFileExists;

  // Legacy approved actions without a stored precondition keep the old behavior.
  if (expectedHash === undefined && expectedExists === undefined) {
    return { allowed: true, verified: false, reason: "Legacy pending action" };
  }

  const snapshot = await getProjectFileSnapshot(filePath);
  if (typeof expectedExists === "boolean" && snapshot.exists !== expectedExists) {
    return { allowed: false, verified: true, reason: "File existence changed after the pending action was created" };
  }

  if (typeof expectedHash === "string" && expectedHash) {
    if (!snapshot.exists) {
      return { allowed: false, verified: true, reason: "File no longer exists" };
    }
    const current = await readProjectFile(filePath);
    if (hashContent(current) !== expectedHash) {
      return { allowed: false, verified: true, reason: "File changed after approval request. Generate a new action." };
    }
  }

  return { allowed: true, verified: true, reason: "File precondition verified" };
}

function buildApprovalOptions(
  action: PendingActionRecord,
  reason: string
) {
  return {
    approvedByGabi: true,
    approvedBy: "Gabi",
    pendingActionId: getActionId(action),
    reason,
    source: "code-tools-handler",
  };
}

async function rememberCodeFile(
  filePath: string,
  content: string,
  source = "code-tools-handler"
) {
  try {
    const normalizedPath = normalizePath(filePath);
    setActiveCodeFile(normalizedPath, content);

    const exports = extractExports(content);
    const functions = extractFunctions(content);
    const imports = extractImports(content);
    const memoryResult = await saveCodeMemory({
      file_path: normalizedPath,
      file_purpose: detectFilePurpose(normalizedPath, content),
      code_summary: createSmartCodeSummary(normalizedPath, content),
      important_exports: exports,
      important_functions: functions,
      imports,
      exports,
      risk_level: detectRiskLevel(normalizedPath, content),
      last_known_content: content,
      metadata: { source },
    });

    const persistentSaved = memoryResult?.supabase?.saved === true;

    return {
      status: memoryResult?.status || "partial",
      runtimeSaved: memoryResult?.runtimeSaved === true,
      saved: persistentSaved,
      supabase: memoryResult?.supabase
        ? {
          status: memoryResult.supabase.status,
          saved: persistentSaved,
          error: memoryResult.supabase.error,
        }
        : null,
      embedding: memoryResult?.embedding
        ? {
          status: memoryResult.embedding.status,
          error: memoryResult.embedding.error,
        }
        : null,
      memoryPayload: {
        file_path: normalizedPath,
        file_purpose: detectFilePurpose(normalizedPath, content),
        important_exports: exports,
        important_functions: functions,
        imports,
        risk_level: detectRiskLevel(normalizedPath, content),
        updated_at: now(),
      },
    };
  } catch (error: any) {
    return {
      status: "failed",
      saved: false,
      runtimeSaved: false,
      error: error?.message || "Code memory save failed",
    };
  }
}

async function getExecutablePendingAction(
  pendingActionId: string,
  allowedTypes: string[]
) {
  if (!pendingActionId) {
    return {
      allowed: false,
      reason:
        "Missing pending action id. Use EXECUTE_* with an approved pending action id.",
      action: null,
      validation: null,
    };
  }

  const action = await getPendingActionById(pendingActionId);

  if (!action) {
    return {
      allowed: false,
      reason: "Pending action not found",
      action: null,
      validation: null,
    };
  }

  const actionType = getActionType(action);

  if (!allowedTypes.includes(actionType)) {
    return {
      allowed: false,
      reason: `Pending action type mismatch. Expected ${allowedTypes.join(
        " or "
      )}, received ${actionType || "unknown"}.`,
      action,
      validation: null,
    };
  }

  const executionCheck = canExecutePendingAction(action);

  return {
    allowed: executionCheck.allowed,
    reason: executionCheck.reason,
    action,
    validation: executionCheck.validation,
  };
}

async function markPendingActionFailedIfPossible(
  action: PendingActionRecord,
  reason: string
) {
  try {
    const id = getActionId(action);

    if (!id) return null;

    return await failPendingAction(id, reason);
  } catch (error: any) {
    return {
      status: "failed",
      error:
        error?.message ||
        "Failed to mark pending action as failed",
    };
  }
}

async function markPendingActionCompleted(action: PendingActionRecord) {
  const id = getActionId(action);

  if (!id) {
    throw new Error("Missing pending action id");
  }

  return completePendingAction(id);
}

function getPatchBlocksFromPendingAction(action: PendingActionRecord) {
  const metadata = action?.metadata || {};
  const searchTextFromMetadata =
    typeof metadata.searchText === "string" ? metadata.searchText : "";
  const replacementTextFromMetadata =
    typeof metadata.replacementText === "string" ? metadata.replacementText : "";

  if (searchTextFromMetadata && replacementTextFromMetadata !== "") {
    return {
      searchText: searchTextFromMetadata,
      replacementText: replacementTextFromMetadata,
    };
  }

  return parseSearchReplaceBlocks(action?.patch || "");
}

async function finishApprovedAction(action: PendingActionRecord) {
  try {
    const completedAction = await markPendingActionCompleted(action);
    if (completedAction?.status === "failed" || completedAction?.error) {
      return { completedAction, completionError: completedAction.error || "Action completion was not confirmed" };
    }
    return { completedAction, completionError: null };
  } catch (error: any) {
    return {
      completedAction: null,
      completionError: error?.message || "File changed, but pending action completion failed",
    };
  }
}

export async function handleListFiles(message = "LIST_FILES: app") {
  try {
    const startDirectory =
      parsePathOnly(message, ["LIST_FILES", "LIST_PROJECT_FILES"]) ||
      "app";

    const files = await listProjectFiles(startDirectory);
    const detailed = await listProjectFilesDetailed(startDirectory);

    return response("LIST_FILES", "completed", {
      status: "completed",
      startDirectory,
      count: files.length,
      files,
      detailed,
      truthPolicy: {
        verifiedFromFilesystem: true,
        noFakeFileList: true,
      },
    });
  } catch (error: any) {
    return response("LIST_FILES", "failed", {
      status: "failed",
      error: error?.message || "Unknown LIST_FILES error",
    });
  }
}

export async function handleReadRealFile(message: string) {
  try {
    const filePath = parsePathOnly(message, [
      "READ_REAL_FILE",
      "READ_FILE",
    ]);

    if (!filePath) {
      return response("READ_REAL_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path",
      });
    }

    const safety = await analyzeProjectFileSafety(filePath);
    if (!safety.canRead || safety.blocked) {
      return response("READ_REAL_FILE", "blocked", {
        status: "blocked",
        filePath,
        reason: "File is not readable under project safety rules",
        safety,
      });
    }
    const content = await readProjectFile(filePath);
    const memory = await rememberCodeFile(
      filePath,
      content,
      "READ_REAL_FILE"
    );

    return response("READ_REAL_FILE", "completed", {
      status: "completed",
      filePath,
      safety,
      content,
      memory,
      truthPolicy: {
        verifiedFromFilesystem: true,
        codeMemoryUpdatedBestEffort: true,
      },
    });
  } catch (error: any) {
    return response("READ_REAL_FILE", "failed", {
      status: "failed",
      error: error?.message || "Unknown READ_REAL_FILE error",
    });
  }
}

export async function handleReadFile(message: string) {
  return handleReadRealFile(message);
}

export async function handleAnalyzeRealFile(message: string) {
  try {
    const filePath = parsePathOnly(message, [
      "ANALYZE_REAL_FILE",
      "ANALYZE_FILE",
    ]);

    if (!filePath) {
      return response("ANALYZE_REAL_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path",
      });
    }

    const snapshot = await getProjectFileSnapshot(filePath);

    if (!snapshot.exists) {
      return response("ANALYZE_REAL_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "File does not exist",
        snapshot,
      });
    }

    const safety = await analyzeProjectFileSafety(filePath);
    if (!safety.canRead || safety.blocked) {
      return response("ANALYZE_REAL_FILE", "blocked", {
        status: "blocked",
        filePath,
        reason: "File is not readable under project safety rules",
        safety,
      });
    }

    const content = await readProjectFile(filePath);

    const analysis = {
      filePath,
      purpose: (detectFilePurpose as any)(filePath, content),
      riskLevel: (detectRiskLevel as any)(filePath, content),
      exports: (extractExports as any)(content),
      functions: (extractFunctions as any)(content),
      summary: await (createSmartCodeSummary as any)(filePath, content),
      safety,
      snapshot,
    };

    const memory = await rememberCodeFile(
      filePath,
      content,
      "ANALYZE_REAL_FILE"
    );

    return response("ANALYZE_REAL_FILE", "completed", {
      status: "completed",
      analysis,
      memory,
      truthPolicy: {
        verifiedFromFilesystem: true,
        analysisBasedOnRealFileContent: true,
      },
    });
  } catch (error: any) {
    return response("ANALYZE_REAL_FILE", "failed", {
      status: "failed",
      error: error?.message || "Unknown ANALYZE_REAL_FILE error",
    });
  }
}

export async function handleWriteFile(message: string) {
  try {
    const { filePath, body } = parsePathAndBody(message, ["WRITE_FILE", "WRITE_REAL_FILE"]);
    if (!filePath || !body.trim()) {
      return response("WRITE_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path or content",
      });
    }

    const validation = validateProjectFilePath(filePath, "write");
    if (!validation.allowed) {
      return response("WRITE_FILE", "blocked", { status: "blocked", filePath, validation });
    }

    const risk = analyzePendingActionRisk({
      action_type: "WRITE_FILE",
      file_path: filePath,
      content: body,
      reason: "Awenia generated file write",
      source: "code-tools-handler",
      requires_approval: true,
    });

    if (risk.blocked) {
      return response("WRITE_FILE", "blocked", {
        status: "blocked",
        filePath,
        risk,
        message: "Risk analysis blocked this action. Nothing was queued or changed.",
      });
    }

    const snapshot = await getProjectFileSnapshot(filePath);
    const previousContent = snapshot.exists ? await readProjectFile(filePath) : null;
    const pendingAction = await savePendingAction({
      action_type: "WRITE_FILE",
      file_path: filePath,
      content: body,
      reason: "Awenia generated file write",
      source: "code-tools-handler",
      requires_approval: true,
      metadata: {
        risk,
        createdByTool: "WRITE_FILE",
        expectedFileExists: snapshot.exists,
        expectedFileHash: previousContent !== null ? hashContent(previousContent) : null,
      },
    });

    const saved = checkPendingActionSaved(pendingAction);
    if (!saved.saved) {
      return response("WRITE_FILE", "failed", {
        status: "failed",
        filePath,
        error: pendingAction?.error || "Pending action was not persisted with an id",
      });
    }

    return response("WRITE_FILE", "pending_approval", {
      status: "pending_approval",
      message: "Write action queued. Gabi approval is required before execution.",
      filePath,
      risk,
      pendingAction,
      noFileChanged: true,
      executeInstruction: `After Gabi approval, use EXECUTE_WRITE_FILE: ${saved.actionId}`,
    });
  } catch (error: any) {
    return response("WRITE_FILE", "failed", {
      status: "failed",
      error: error?.message || "Unknown WRITE_FILE error",
    });
  }
}

export async function handlePatchFile(message: string) {
  try {
    const parsed = parsePatch(message);
    if (!parsed.filePath || !parsed.searchText || !parsed.replacementText) {
      return response("PATCH_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Provide file path and valid SEARCH:/REPLACE: blocks; empty blocks are not accepted",
      });
    }

    const validation = validateProjectFilePath(parsed.filePath, "patch");
    if (!validation.allowed) {
      return response("PATCH_FILE", "blocked", {
        status: "blocked",
        filePath: parsed.filePath,
        validation,
      });
    }

    const risk = analyzePendingActionRisk({
      action_type: "PATCH_FILE",
      file_path: parsed.filePath,
      patch: parsed.patch,
      reason: "Awenia generated file patch",
      source: "code-tools-handler",
      requires_approval: true,
    });

    if (risk.blocked) {
      return response("PATCH_FILE", "blocked", {
        status: "blocked",
        filePath: parsed.filePath,
        risk,
        message: "Risk analysis blocked this action. Nothing was queued or changed.",
      });
    }

    if (parsed.searchText === parsed.replacementText) {
      return response("PATCH_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "The proposed patch makes no change",
      });
    }

    const currentContent = await readProjectFile(parsed.filePath);
    const matches = countOccurrences(currentContent, parsed.searchText);
    if (matches !== 1) {
      return response("PATCH_FILE", "needs_attention", {
        status: "needs_attention",
        filePath: parsed.filePath,
        matchCount: matches,
        reason: "SEARCH text must match exactly once. Nothing was queued or changed.",
      });
    }

    const pendingAction = await savePendingAction({
      action_type: "PATCH_FILE",
      file_path: parsed.filePath,
      patch: parsed.patch,
      reason: "Awenia generated file patch",
      source: "code-tools-handler",
      requires_approval: true,
      metadata: {
        risk,
        searchText: parsed.searchText,
        replacementText: parsed.replacementText,
        createdByTool: "PATCH_FILE",
        expectedFileExists: true,
        expectedFileHash: hashContent(currentContent),
      },
    });

    const saved = checkPendingActionSaved(pendingAction);
    if (!saved.saved) {
      return response("PATCH_FILE", "failed", {
        status: "failed",
        filePath: parsed.filePath,
        error: pendingAction?.error || "Pending action was not persisted with an id",
      });
    }

    return response("PATCH_FILE", "pending_approval", {
      status: "pending_approval",
      message: "Patch queued. Gabi approval is required before execution.",
      filePath: parsed.filePath,
      risk,
      matchCount: matches,
      pendingAction,
      noFileChanged: true,
      executeInstruction: `After Gabi approval, use EXECUTE_PATCH_FILE: ${saved.actionId}`,
    });
  } catch (error: any) {
    return response("PATCH_FILE", "failed", {
      status: "failed",
      error: error?.message || "Unknown PATCH_FILE error",
    });
  }
}

export async function handleExecuteWriteFile(message: string) {
  let action: PendingActionRecord = null;

  try {
    const pendingActionId = parsePendingActionId(message, [
      "EXECUTE_WRITE",
      "EXECUTE_WRITE_FILE",
    ]);

    const executable = await getExecutablePendingAction(
      pendingActionId,
      ["WRITE_FILE"]
    );

    action = executable.action;

    if (!executable.allowed || !action) {
      return response("EXECUTE_WRITE_FILE", "blocked", {
        status: "blocked",
        reason: executable.reason,
        validation: executable.validation,
        pendingActionId,
        action,
      });
    }

    const filePath = normalizePath(action.file_path);
    const content = String(action.content || "");

    if (!filePath || !content) {
      return response("EXECUTE_WRITE_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Approved pending write action is missing file path or content",
        action,
      });
    }

    const validation = validateProjectFilePath(filePath, "write");

    if (!validation.allowed) {
      return response("EXECUTE_WRITE_FILE", "blocked", {
        status: "blocked",
        validation,
        action,
      });
    }

    const precondition = await checkFilePrecondition(action, filePath);
    if (!precondition.allowed) {
      return response("EXECUTE_WRITE_FILE", "blocked", {
        status: "blocked",
        filePath,
        precondition,
        reason: "File state differs from the approved action; create a new pending action.",
      });
    }

    const result = await writeProjectFile(
      filePath,
      content,
      buildApprovalOptions(
        action,
        "Approved pending write action executed by code-tools-handler"
      )
    );

    const completion = await finishApprovedAction(action);
    const memory = await rememberCodeFile(filePath, content, "EXECUTE_WRITE_FILE");
    const finalStatus: CodeToolStatus = completion.completionError ? "needs_attention" : "completed";

    return response("EXECUTE_WRITE_FILE", finalStatus, {
      status: finalStatus,
      fileChanged: true,
      result,
      memory,
      completedAction: completion.completedAction,
      completionError: completion.completionError,
      truthPolicy: {
        executedOnlyAfterPendingApproval: true,
        fileWrittenByDevAgent: true,
        devAgentReceivedExplicitApproval: true,
      },
    });
  } catch (error: any) {
    const reason =
      error?.message || "Unknown EXECUTE_WRITE_FILE error";

    const failedAction = action
      ? await markPendingActionFailedIfPossible(action, reason)
      : null;

    return response("EXECUTE_WRITE_FILE", "failed", {
      status: "failed",
      error: reason,
      failedAction,
    });
  }
}

export async function handleExecutePatchFile(message: string) {
  let action: PendingActionRecord = null;

  try {
    const pendingActionId = parsePendingActionId(message, [
      "EXECUTE_PATCH",
      "EXECUTE_PATCH_FILE",
    ]);

    const executable = await getExecutablePendingAction(
      pendingActionId,
      ["PATCH_FILE"]
    );

    action = executable.action;

    if (!executable.allowed || !action) {
      return response("EXECUTE_PATCH_FILE", "blocked", {
        status: "blocked",
        reason: executable.reason,
        validation: executable.validation,
        pendingActionId,
        action,
      });
    }

    const filePath = normalizePath(action.file_path);
    const blocks = getPatchBlocksFromPendingAction(action);

    if (!filePath || !blocks.searchText || !blocks.replacementText) {
      return response("EXECUTE_PATCH_FILE", "needs_attention", {
        status: "needs_attention",
        reason:
          "Approved pending patch action needs file path plus SEARCH and REPLACE blocks.",
        action,
      });
    }

    const validation = validateProjectFilePath(filePath, "patch");

    if (!validation.allowed) {
      return response("EXECUTE_PATCH_FILE", "blocked", {
        status: "blocked",
        validation,
        action,
      });
    }

    const precondition = await checkFilePrecondition(action, filePath);
    if (!precondition.allowed) {
      return response("EXECUTE_PATCH_FILE", "blocked", {
        status: "blocked",
        filePath,
        precondition,
        reason: "File changed after patch request; create a new pending action.",
      });
    }

    const currentContent = await readProjectFile(filePath);
    const matchCount = countOccurrences(currentContent, blocks.searchText);
    if (matchCount !== 1 || blocks.searchText === blocks.replacementText) {
      return response("EXECUTE_PATCH_FILE", "blocked", {
        status: "blocked",
        filePath,
        matchCount,
        reason: "Approved SEARCH text is no longer a single unambiguous change.",
      });
    }

    const result = await patchProjectFile(
      filePath,
      blocks.searchText,
      blocks.replacementText,
      buildApprovalOptions(
        action,
        "Approved pending patch action executed by code-tools-handler"
      )
    );

    const completion = await finishApprovedAction(action);
    const content = await readProjectFile(filePath);
    const memory = await rememberCodeFile(filePath, content, "EXECUTE_PATCH_FILE");
    const finalStatus: CodeToolStatus = completion.completionError ? "needs_attention" : "completed";

    return response("EXECUTE_PATCH_FILE", finalStatus, {
      status: finalStatus,
      fileChanged: true,
      result,
      memory,
      completedAction: completion.completedAction,
      completionError: completion.completionError,
      truthPolicy: {
        executedOnlyAfterPendingApproval: true,
        filePatchedByDevAgent: true,
        devAgentReceivedExplicitApproval: true,
      },
    });
  } catch (error: any) {
    const reason =
      error?.message || "Unknown EXECUTE_PATCH_FILE error";

    const failedAction = action
      ? await markPendingActionFailedIfPossible(action, reason)
      : null;

    return response("EXECUTE_PATCH_FILE", "failed", {
      status: "failed",
      error: reason,
      failedAction,
    });
  }
}

export async function handleRollbackFile(message: string) {
  try {
    const filePath = parsePathOnly(message, ["ROLLBACK_FILE", "ROLLBACK_REAL_FILE"]);
    if (!filePath) {
      return response("ROLLBACK_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path",
      });
    }

    const validation = validateProjectFilePath(filePath, "rollback");
    if (!validation.allowed) {
      return response("ROLLBACK_FILE", "blocked", { status: "blocked", filePath, validation });
    }

    const risk = analyzePendingActionRisk({
      action_type: "ROLLBACK_FILE",
      file_path: filePath,
      reason: "Awenia requested rollback",
      source: "code-tools-handler",
      requires_approval: true,
    });
    if (risk.blocked) {
      return response("ROLLBACK_FILE", "blocked", {
        status: "blocked", filePath, risk,
        message: "Rollback blocked by risk analysis; nothing queued or changed.",
      });
    }

    const snapshot = await getProjectFileSnapshot(filePath);
    if (!snapshot.exists) {
      return response("ROLLBACK_FILE", "needs_attention", {
        status: "needs_attention", filePath, reason: "Target file does not exist",
      });
    }

    const currentContent = await readProjectFile(filePath);
    const pendingAction = await savePendingAction({
      action_type: "ROLLBACK_FILE",
      file_path: filePath,
      reason: "Awenia requested rollback",
      source: "code-tools-handler",
      requires_approval: true,
      metadata: {
        risk,
        createdByTool: "ROLLBACK_FILE",
        expectedFileExists: true,
        expectedFileHash: hashContent(currentContent),
      },
    });

    const saved = checkPendingActionSaved(pendingAction);
    if (!saved.saved) {
      return response("ROLLBACK_FILE", "failed", {
        status: "failed", filePath,
        error: pendingAction?.error || "Pending action was not persisted with an id",
      });
    }

    return response("ROLLBACK_FILE", "pending_approval", {
      status: "pending_approval",
      message: "Rollback queued. Gabi approval is required before execution.",
      filePath, risk, pendingAction, noFileChanged: true,
      executeInstruction: `After Gabi approval, use EXECUTE_ROLLBACK_FILE: ${saved.actionId}`,
    });
  } catch (error: any) {
    return response("ROLLBACK_FILE", "failed", {
      status: "failed", error: error?.message || "Unknown ROLLBACK_FILE error",
    });
  }
}

export async function handleExecuteRollbackFile(message: string) {
  let action: PendingActionRecord = null;

  try {
    const pendingActionId = parsePendingActionId(message, [
      "EXECUTE_ROLLBACK",
      "EXECUTE_ROLLBACK_FILE",
    ]);

    const executable = await getExecutablePendingAction(
      pendingActionId,
      ["ROLLBACK_FILE"]
    );

    action = executable.action;

    if (!executable.allowed || !action) {
      return response("EXECUTE_ROLLBACK_FILE", "blocked", {
        status: "blocked",
        reason: executable.reason,
        validation: executable.validation,
        pendingActionId,
        action,
      });
    }

    const filePath = normalizePath(action.file_path);

    if (!filePath) {
      return response("EXECUTE_ROLLBACK_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Approved pending rollback action is missing file path",
        action,
      });
    }

    const validation = validateProjectFilePath(filePath, "rollback");

    if (!validation.allowed) {
      return response("EXECUTE_ROLLBACK_FILE", "blocked", {
        status: "blocked",
        validation,
        action,
      });
    }

    const precondition = await checkFilePrecondition(action, filePath);
    if (!precondition.allowed) {
      return response("EXECUTE_ROLLBACK_FILE", "blocked", {
        status: "blocked", filePath, precondition,
        reason: "File changed after rollback request. Create a new pending action.",
      });
    }

    const result = await rollbackProjectFile(
      filePath,
      buildApprovalOptions(
        action,
        "Approved pending rollback action executed by code-tools-handler"
      )
    );

    const completion = await finishApprovedAction(action);
    const content = await readProjectFile(filePath);
    const memory = await rememberCodeFile(filePath, content, "EXECUTE_ROLLBACK_FILE");
    const finalStatus: CodeToolStatus = completion.completionError ? "needs_attention" : "completed";

    return response("EXECUTE_ROLLBACK_FILE", finalStatus, {
      status: finalStatus,
      fileChanged: true,
      result,
      memory,
      completedAction: completion.completedAction,
      completionError: completion.completionError,
      truthPolicy: {
        executedOnlyAfterPendingApproval: true,
        rollbackByDevAgent: true,
        devAgentReceivedExplicitApproval: true,
      },
    });
  } catch (error: any) {
    const reason =
      error?.message || "Unknown EXECUTE_ROLLBACK_FILE error";

    const failedAction = action
      ? await markPendingActionFailedIfPossible(action, reason)
      : null;

    return response("EXECUTE_ROLLBACK_FILE", "failed", {
      status: "failed",
      error: reason,
      failedAction,
    });
  }
}

export async function handleGeneratePatch(message: string) {
  try {
    const { filePath, body } = parsePathAndBody(message, ["GENERATE_PATCH", "CREATE_PATCH"]);
    if (!filePath || !body.trim()) {
      return response("GENERATE_PATCH", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path or patch request",
      });
    }

    const currentContent = await readProjectFile(filePath);
    const safety = await analyzeProjectFileSafety(filePath);
    if (!safety.canRead || safety.blocked) {
      return response("GENERATE_PATCH", "blocked", {
        status: "blocked", filePath, safety,
      });
    }

    // Natural-language requests are handled by the AI coding proposal engine.
    // Existing SEARCH/REPLACE requests retain the original preview behavior.
    const requestedBlocks = parseSearchReplaceBlocks(body);

    if (!requestedBlocks.searchText && !requestedBlocks.replacementText) {
      const { prepareCoderProposal } = await import("./agent-orchestrator");
      const coderResult = await prepareCoderProposal(filePath, body);

      if (
        coderResult.status !== "ready_for_review" ||
        !coderResult.proposal
      ) {
        return response("GENERATE_PATCH", "failed", {
          status: "failed",
          agentId: "coder",
          error: coderResult.error || "Coder proposal generation failed.",
          noFileChanged: true,
        });
      }

      const proposal = coderResult.proposal;

      return response("GENERATE_PATCH", "completed", {
        status: "completed",
        proposal,
        noFileChanged: true,
        message: "AI proposal only. Review before queuing PATCH_FILE.",
      });
    }

    const blocks = parseSearchReplaceBlocks(body);
    const matchCount = blocks.searchText
      ? countOccurrences(currentContent, blocks.searchText)
      : null;
    const noChange = Boolean(blocks.searchText && blocks.searchText === blocks.replacementText);

    const patchPlan = {
      filePath,
      request: body,
      safety,
      currentPreview: currentContent.slice(0, 3000),
      matchCount,
      patchApplicableOnce: matchCount === 1 && !noChange && Boolean(blocks.replacementText),
      noChange,
      instruction: "Review the SEARCH/REPLACE blocks against verified content before queuing with PATCH_FILE.",
      format: { search: "SEARCH:", replace: "REPLACE:" },
      truthPolicy: { noFileChanged: true, verifiedFromFilesystem: true },
    };

    const memory = await rememberCodeFile(filePath, currentContent, "GENERATE_PATCH");
    return response("GENERATE_PATCH", "completed", {
      status: "completed",
      patchPlan,
      memory,
    });
  } catch (error: any) {
    return response("GENERATE_PATCH", "failed", {
      status: "failed", error: error?.message || "Unknown GENERATE_PATCH error",
    });
  }
}

export async function handleSearchFiles(message: string) {
  try {
    const query = stripCommand(message, [
      "SEARCH_FILES",
      "FIND_FILES",
    ]);

    const matches = await searchProjectFiles(query || "", "app");

    return response("SEARCH_FILES", "completed", {
      status: "completed",
      query,
      count: matches.length,
      matches,
    });
  } catch (error: any) {
    return response("SEARCH_FILES", "failed", {
      status: "failed",
      error: error?.message || "Unknown SEARCH_FILES error",
    });
  }
}

export async function handleSearchInsideFiles(message: string) {
  try {
    const query = stripCommand(message, [
      "SEARCH_INSIDE_FILES",
      "SEARCH_INSIDE_FILE",
      "SEARCH_INSIDE",
      "SEARCH_CODE",
    ]);

    const matches = await searchInsideProjectFiles(query || "", "app", 20);

    return response("SEARCH_INSIDE_FILES", "completed", {
      status: "completed",
      query,
      count: matches.length,
      matches,
    });
  } catch (error: any) {
    return response("SEARCH_INSIDE_FILES", "failed", {
      status: "failed",
      error: error?.message || "Unknown SEARCH_INSIDE_FILES error",
    });
  }
}

export async function handlePatchBatch(message: string) {
  try {
    const input = JSON.parse(stripCommand(message, ["PATCH_BATCH"]));
    const patches: unknown[] = input?.patches;
    if (!Array.isArray(patches) || patches.length < 1 || patches.length > 20) {
      return response("PATCH_BATCH", "needs_attention", {
        status: "needs_attention", reason: "Provide 1 to 20 patches in JSON patches[].",
      });
    }

    const staged = new Map<string, string>();
    const prepared: Array<{
      filePath: string; search: string; replace: string;
      currentHash: string; risk: any; patch: string;
    }> = [];

    // Validate the entire batch before creating any pending actions.
    for (const [index, item] of patches.entries()) {
      const p = item as Record<string, unknown>;
      const filePath = normalizePath(String(p?.filePath || ""));
      const search = p?.search;
      const replace = p?.replace;
      if (!filePath || typeof search !== "string" || typeof replace !== "string" ||
          !search || !replace || search === replace || search.length > 12000 || replace.length > 15000) {
        return response("PATCH_BATCH", "needs_attention", {
          status: "needs_attention", index, reason: "Invalid filePath/search/replace.",
        });
      }
      const validation = validateProjectFilePath(filePath, "patch");
      const safety = await analyzeProjectFileSafety(filePath);
      if (!validation.allowed || !safety.canRead || safety.blocked) {
        return response("PATCH_BATCH", "blocked", {
          status: "blocked", filePath, validation, safety,
        });
      }
      const key = filePath.toLowerCase();
      const currentContent = staged.get(key) ?? await readProjectFile(filePath);
      if (countOccurrences(currentContent, search) !== 1) {
        return response("PATCH_BATCH", "needs_attention", {
          status: "needs_attention", filePath,
          reason: "SEARCH must match exactly once. No batch actions were queued.",
        });
      }
      const patch = `SEARCH:\n${search}\n\nREPLACE:\n${replace}`;
      const risk = analyzePendingActionRisk({
        action_type: "PATCH_FILE", file_path: filePath, patch,
        reason: "Awenia batch patch", source: "code-tools-handler",
        requires_approval: true,
      });
      if (risk.blocked || risk.valid === false) {
        return response("PATCH_BATCH", "blocked", { status: "blocked", filePath, risk });
      }
      prepared.push({
        filePath, search, replace, patch, risk,
        currentHash: hashContent(currentContent),
      });
      staged.set(key, currentContent.replace(search, () => replace));
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pendingActionIds: string[] = [];
    for (const [index, p] of prepared.entries()) {
      let action: any;
      try {
        action = await savePendingAction({
          action_type: "PATCH_FILE", file_path: p.filePath, patch: p.patch,
          reason: "Awenia batch patch", source: "code-tools-handler",
          requires_approval: true,
          metadata: {
            risk: p.risk, searchText: p.search, replacementText: p.replace,
            createdByTool: "PATCH_BATCH", expectedFileExists: true,
            expectedFileHash: p.currentHash, batchId,
            batchSize: prepared.length, batchPosition: index,
          },
        });
      } catch (error: any) {
        return response("PATCH_BATCH", "needs_attention", {
          status: "needs_attention", batchId, pendingActionIds,
          error: error?.message || String(error),
          message: "Some actions may be queued. No files changed.",
        });
      }
      const saved = checkPendingActionSaved(action);
      if (!saved.saved) {
        return response("PATCH_BATCH", "needs_attention", {
          status: "needs_attention", batchId, pendingActionIds,
          error: action?.error || "Batch was only partially queued. No files changed.",
        });
      }
      pendingActionIds.push(saved.actionId);
    }
    return response("PATCH_BATCH", "pending_approval", {
      status: "pending_approval", batchId, pendingActionIds,
      message: "Each action requires owner approval. No files changed.",
      noFileChanged: true,
      executeInstruction: `After approving all IDs: EXECUTE_PATCH_BATCH: ${pendingActionIds.join(",")}`,
    });
  } catch (error: any) {
    return response("PATCH_BATCH", "failed", {
      status: "failed", error: error?.message || String(error),
    });
  }
}

export async function handleExecutePatchBatch(message: string) {
  try {
    const ids = stripCommand(message, ["EXECUTE_PATCH_BATCH"])
      .split(/[\s,]+/).filter(Boolean);
    if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length ||
        ids.some((id) => !/^\d+$/.test(id))) {
      return response("EXECUTE_PATCH_BATCH", "needs_attention", {
        status: "needs_attention", reason: "Provide 1 to 20 unique numeric pending action IDs.",
      });
    }

    const items: Array<{
      id: string; position: number; filePath: string; action: PendingActionRecord;
    }> = [];
    let batchId = "";
    // All items must be approved and still valid before the first file write.
    for (const id of ids) {
      const check = await getExecutablePendingAction(id, ["PATCH_FILE"]);
      const action = check.action;
      if (!check.allowed || !action) {
        return response("EXECUTE_PATCH_BATCH", "blocked", {
          status: "blocked", id, reason: check.reason, noFileChanged: true,
        });
      }
      const meta = action.metadata || {};
      const filePath = normalizePath(action.file_path);
      if (!meta.batchId || meta.createdByTool !== "PATCH_BATCH" ||
          meta.batchSize !== ids.length ||
          (batchId && batchId !== meta.batchId) ||
          !Number.isInteger(meta.batchPosition)) {
        return response("EXECUTE_PATCH_BATCH", "blocked", {
          status: "blocked", id, reason: "Invalid or incomplete batch group.",
          noFileChanged: true,
        });
      }
      batchId = meta.batchId;
      items.push({ id, position: meta.batchPosition, filePath, action });
    }
    items.sort((a, b) => a.position - b.position);
    if (items.some((item, index) => item.position !== index)) {
      return response("EXECUTE_PATCH_BATCH", "blocked", {
        status: "blocked", reason: "Batch contains missing or repeated positions.",
        noFileChanged: true,
      });
    }

    // Simulate the approved order in memory, including multiple edits per file.
    const staged = new Map<string, string>();
    for (const item of items) {
      const key = item.filePath.toLowerCase();
      const firstForFile = !staged.has(key);
      const current = staged.get(key) ?? await readProjectFile(item.filePath);
      const blocks = getPatchBlocksFromPendingAction(item.action);
      const meta = item.action.metadata || {};
      const validation = validateProjectFilePath(item.filePath, "patch");
      const precondition = firstForFile
        ? await checkFilePrecondition(item.action, item.filePath)
        : { allowed: true };
      if (!validation.allowed || !precondition.allowed ||
          meta.expectedFileHash !== hashContent(current) ||
          !blocks.searchText || !blocks.replacementText ||
          blocks.searchText === blocks.replacementText ||
          countOccurrences(current, blocks.searchText) !== 1) {
        return response("EXECUTE_PATCH_BATCH", "blocked", {
          status: "blocked", id: item.id, filePath: item.filePath,
          reason: "Batch preflight failed: source hash or SEARCH mismatch.",
          noFileChanged: true,
        });
      }
      staged.set(key, current.replace(blocks.searchText, () => blocks.replacementText));
    }

    const completed: Array<{ id: string; filePath: string }> = [];
    for (const item of items) {
      const result = await handleExecutePatchFile(`EXECUTE_PATCH_FILE: ${item.id}`);
      const payload: any = await result.json();
      if (payload.status !== "completed") {
        return response("EXECUTE_PATCH_BATCH", "needs_attention", {
          status: "needs_attention", batchId, completed,
          stoppedAt: item, failure: payload.data,
          message: "Execution stopped. Earlier files may have changed; inspect before resuming.",
        });
      }
      completed.push({ id: item.id, filePath: item.filePath });
    }
    return response("EXECUTE_PATCH_BATCH", "completed", {
      status: "completed", batchId, completed,
      message: "All approved patches applied sequentially with existing dev-agent backups.",
    });
  } catch (error: any) {
    return response("EXECUTE_PATCH_BATCH", "failed", {
      status: "failed", error: error?.message || String(error),
    });
  }
}

export async function handleCodeToolCommand(message: string) {
  if (matchesCommand(message, "PATCH_BATCH")) return handlePatchBatch(message);
  if (matchesCommand(message, "EXECUTE_PATCH_BATCH")) return handleExecutePatchBatch(message);
  const commandRoutes: Array<{ names: string[]; handler: (message: string) => Promise<Response> }> = [
    { names: ["LIST_FILES", "LIST_PROJECT_FILES"], handler: handleListFiles },
    { names: ["READ_REAL_FILE", "READ_FILE"], handler: handleReadRealFile },
    { names: ["ANALYZE_REAL_FILE", "ANALYZE_FILE"], handler: handleAnalyzeRealFile },
    { names: ["WRITE_REAL_FILE", "WRITE_FILE"], handler: handleWriteFile },
    { names: ["PATCH_REAL_FILE", "PATCH_FILE"], handler: handlePatchFile },
    { names: ["EXECUTE_WRITE_FILE", "EXECUTE_WRITE"], handler: handleExecuteWriteFile },
    { names: ["EXECUTE_PATCH_FILE", "EXECUTE_PATCH"], handler: handleExecutePatchFile },
    { names: ["ROLLBACK_REAL_FILE", "ROLLBACK_FILE"], handler: handleRollbackFile },
    { names: ["EXECUTE_ROLLBACK_FILE", "EXECUTE_ROLLBACK"], handler: handleExecuteRollbackFile },
    { names: ["GENERATE_PATCH", "CREATE_PATCH"], handler: handleGeneratePatch },
    { names: ["SEARCH_FILES", "FIND_FILES"], handler: handleSearchFiles },
    { names: ["SEARCH_INSIDE_FILES", "SEARCH_INSIDE_FILE", "SEARCH_INSIDE", "SEARCH_CODE"], handler: handleSearchInsideFiles },
  ];

  for (const route of commandRoutes) {
    if (route.names.some((name) => matchesCommand(message, name))) {
      return route.handler(message);
    }
  }

  return response("CODE_TOOL", "needs_attention", {
    status: "needs_attention",
    reason: "Unknown code tool command",
    supportedCommands: [
      "LIST_FILES: app",
      "READ_REAL_FILE: app/file.ts",
      "ANALYZE_REAL_FILE: app/file.ts",
      "WRITE_FILE: app/file.ts",
      "PATCH_FILE: app/file.ts",
      "EXECUTE_WRITE_FILE: pending_action_id",
      "EXECUTE_PATCH_FILE: pending_action_id",
      "ROLLBACK_FILE: app/file.ts",
      "EXECUTE_ROLLBACK_FILE: pending_action_id",
      "GENERATE_PATCH: app/file.ts",
      "SEARCH_FILES: query",
      "SEARCH_INSIDE_FILES: query",
    ],
  });
}

export const handleCodeCommand = handleCodeToolCommand;

export default handleCodeToolCommand;