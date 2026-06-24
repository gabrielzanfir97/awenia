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
  const match = String(text || "").match(/```[\w-]*\n([\s\S]*?)```/);

  if (match?.[1]) {
    return match[1].replace(/^\n/, "").replace(/\n$/, "");
  }

  return String(text || "").trim();
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
  const body = String(text || "");

  const searchMatch = body.match(/SEARCH:\s*([\s\S]*?)\s*REPLACE:/i);
  const replaceMatch = body.match(/REPLACE:\s*([\s\S]*)/i);

  return {
    searchText: searchMatch?.[1]?.trim() || "",
    replacementText: replaceMatch?.[1]?.trim() || "",
  };
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
  return String(action?.id || "").trim();
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

    await setActiveCodeFile(normalizedPath);

    const summary = await (createSmartCodeSummary as any)(
      normalizedPath,
      content
    );

    const memoryPayload = {
      file_path: normalizedPath,
      file_purpose: (detectFilePurpose as any)(normalizedPath, content),
      code_summary: summary,
      important_exports: (extractExports as any)(content),
      important_functions: (extractFunctions as any)(content),
      risk_level: (detectRiskLevel as any)(normalizedPath, content),
      last_known_content: String(content || "").slice(0, 12000),
      source,
      updated_at: now(),
    };

    await (saveCodeMemory as any)(memoryPayload);

    return {
      saved: true,
      memoryPayload,
    };
  } catch (error: any) {
    return {
      saved: false,
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
    typeof metadata.replacementText === "string"
      ? metadata.replacementText
      : "";

  if (searchTextFromMetadata && replacementTextFromMetadata) {
    return {
      searchText: searchTextFromMetadata,
      replacementText: replacementTextFromMetadata,
    };
  }

  return parseSearchReplaceBlocks(action?.patch || "");
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

    const content = await readProjectFile(filePath);

    const analysis = {
      filePath,
      purpose: (detectFilePurpose as any)(filePath, content),
      riskLevel: (detectRiskLevel as any)(filePath, content),
      exports: (extractExports as any)(content),
      functions: (extractFunctions as any)(content),
      summary: await (createSmartCodeSummary as any)(filePath, content),
      safety: await analyzeProjectFileSafety(filePath),
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
    const { filePath, body } = parsePathAndBody(message, [
      "WRITE_FILE",
      "WRITE_REAL_FILE",
    ]);

    if (!filePath || !body) {
      return response("WRITE_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path or content",
      });
    }

    const risk = analyzePendingActionRisk({
      action_type: "WRITE_FILE",
      file_path: filePath,
      content: body,
      reason: "Awenia generated file write",
      source: "code-tools-handler",
      requires_approval: true,
    });

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
      },
    });

    return response(
      "WRITE_FILE",
      risk.blocked ? "blocked" : "pending_approval",
      {
        status: risk.blocked ? "blocked" : "pending_approval",
        message:
          "Write action saved as pending. It must be approved before execution.",
        filePath,
        risk,
        pendingAction,
        executeInstruction:
          pendingAction?.id && !risk.blocked
            ? `After Gabi approval, use EXECUTE_WRITE_FILE: ${pendingAction.id}`
            : null,
      }
    );
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

    if (!parsed.filePath || !parsed.patch) {
      return response("PATCH_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path or patch content",
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
      },
    });

    return response(
      "PATCH_FILE",
      risk.blocked ? "blocked" : "pending_approval",
      {
        status: risk.blocked ? "blocked" : "pending_approval",
        message:
          "Patch action saved as pending. It must be approved before execution.",
        filePath: parsed.filePath,
        risk,
        pendingAction,
        executeInstruction:
          pendingAction?.id && !risk.blocked
            ? `After Gabi approval, use EXECUTE_PATCH_FILE: ${pendingAction.id}`
            : null,
      }
    );
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

    const result = await writeProjectFile(
      filePath,
      content,
      buildApprovalOptions(
        action,
        "Approved pending write action executed by code-tools-handler"
      )
    );

    const memory = await rememberCodeFile(
      filePath,
      content,
      "EXECUTE_WRITE_FILE"
    );

    const completedAction = await markPendingActionCompleted(action);

    return response("EXECUTE_WRITE_FILE", "completed", {
      status: "completed",
      result,
      memory,
      completedAction,
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

    const result = await patchProjectFile(
      filePath,
      blocks.searchText,
      blocks.replacementText,
      buildApprovalOptions(
        action,
        "Approved pending patch action executed by code-tools-handler"
      )
    );

    const content = await readProjectFile(filePath);

    const memory = await rememberCodeFile(
      filePath,
      content,
      "EXECUTE_PATCH_FILE"
    );

    const completedAction = await markPendingActionCompleted(action);

    return response("EXECUTE_PATCH_FILE", "completed", {
      status: "completed",
      result,
      memory,
      completedAction,
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
    const filePath = parsePathOnly(message, [
      "ROLLBACK_FILE",
      "ROLLBACK_REAL_FILE",
    ]);

    if (!filePath) {
      return response("ROLLBACK_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path",
      });
    }

    const risk = analyzePendingActionRisk({
      action_type: "ROLLBACK_FILE",
      file_path: filePath,
      reason: "Awenia requested rollback",
      source: "code-tools-handler",
      requires_approval: true,
    });

    const pendingAction = await savePendingAction({
      action_type: "ROLLBACK_FILE",
      file_path: filePath,
      reason: "Awenia requested rollback",
      source: "code-tools-handler",
      requires_approval: true,
      metadata: {
        risk,
        createdByTool: "ROLLBACK_FILE",
      },
    });

    return response(
      "ROLLBACK_FILE",
      risk.blocked ? "blocked" : "pending_approval",
      {
        status: risk.blocked ? "blocked" : "pending_approval",
        message:
          "Rollback action saved as pending. It must be approved before execution.",
        filePath,
        risk,
        pendingAction,
        executeInstruction:
          pendingAction?.id && !risk.blocked
            ? `After Gabi approval, use EXECUTE_ROLLBACK_FILE: ${pendingAction.id}`
            : null,
      }
    );
  } catch (error: any) {
    return response("ROLLBACK_FILE", "failed", {
      status: "failed",
      error: error?.message || "Unknown ROLLBACK_FILE error",
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

    const result = await rollbackProjectFile(
      filePath,
      buildApprovalOptions(
        action,
        "Approved pending rollback action executed by code-tools-handler"
      )
    );

    const content = await readProjectFile(filePath);

    const memory = await rememberCodeFile(
      filePath,
      content,
      "EXECUTE_ROLLBACK_FILE"
    );

    const completedAction = await markPendingActionCompleted(action);

    return response("EXECUTE_ROLLBACK_FILE", "completed", {
      status: "completed",
      result,
      memory,
      completedAction,
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
    const { filePath, body } = parsePathAndBody(message, [
      "GENERATE_PATCH",
      "CREATE_PATCH",
    ]);

    if (!filePath || !body) {
      return response("GENERATE_PATCH", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path or patch request",
      });
    }

    const currentContent = await readProjectFile(filePath);
    const safety = await analyzeProjectFileSafety(filePath);

    const patchPlan = {
      filePath,
      request: body,
      safety,
      currentPreview: currentContent.slice(0, 3000),
      instruction:
        "Generate a SEARCH/REPLACE patch using the currentPreview as verified file context.",
      format: {
        search: "SEARCH:",
        replace: "REPLACE:",
      },
      truthPolicy: {
        noFileChanged: true,
        verifiedFromFilesystem: true,
      },
    };

    await rememberCodeFile(
      filePath,
      currentContent,
      "GENERATE_PATCH"
    );

    return response("GENERATE_PATCH", "completed", {
      status: "completed",
      patchPlan,
    });
  } catch (error: any) {
    return response("GENERATE_PATCH", "failed", {
      status: "failed",
      error: error?.message || "Unknown GENERATE_PATCH error",
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

export async function handleCodeToolCommand(message: string) {
  const upper = String(message || "").trim().toUpperCase();

  if (
    upper.startsWith("LIST_FILES") ||
    upper.startsWith("LIST_PROJECT_FILES")
  ) {
    return handleListFiles(message);
  }

  if (
    upper.startsWith("READ_REAL_FILE") ||
    upper.startsWith("READ_FILE")
  ) {
    return handleReadRealFile(message);
  }

  if (
    upper.startsWith("ANALYZE_REAL_FILE") ||
    upper.startsWith("ANALYZE_FILE")
  ) {
    return handleAnalyzeRealFile(message);
  }

  if (
    upper.startsWith("WRITE_FILE") ||
    upper.startsWith("WRITE_REAL_FILE")
  ) {
    return handleWriteFile(message);
  }

  if (
    upper.startsWith("PATCH_FILE") ||
    upper.startsWith("PATCH_REAL_FILE")
  ) {
    return handlePatchFile(message);
  }

  if (
    upper.startsWith("EXECUTE_WRITE") ||
    upper.startsWith("EXECUTE_WRITE_FILE")
  ) {
    return handleExecuteWriteFile(message);
  }

  if (
    upper.startsWith("EXECUTE_PATCH") ||
    upper.startsWith("EXECUTE_PATCH_FILE")
  ) {
    return handleExecutePatchFile(message);
  }

  if (
    upper.startsWith("ROLLBACK_FILE") ||
    upper.startsWith("ROLLBACK_REAL_FILE")
  ) {
    return handleRollbackFile(message);
  }

  if (
    upper.startsWith("EXECUTE_ROLLBACK") ||
    upper.startsWith("EXECUTE_ROLLBACK_FILE")
  ) {
    return handleExecuteRollbackFile(message);
  }

  if (
    upper.startsWith("GENERATE_PATCH") ||
    upper.startsWith("CREATE_PATCH")
  ) {
    return handleGeneratePatch(message);
  }

  if (
    upper.startsWith("SEARCH_FILES") ||
    upper.startsWith("FIND_FILES")
  ) {
    return handleSearchFiles(message);
  }

  if (
    upper.startsWith("SEARCH_INSIDE_FILES") ||
    upper.startsWith("SEARCH_INSIDE_FILE") ||
    upper.startsWith("SEARCH_INSIDE") ||
    upper.startsWith("SEARCH_CODE")
  ) {
    return handleSearchInsideFiles(message);
  }

  return response("CODE_TOOL", "needs_attention", {
    status: "needs_attention",
    reason: "Unknown code tool command",
    message,
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