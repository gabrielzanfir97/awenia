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
} from "./pending-actions";

export type CodeToolStatus =
  | "completed"
  | "pending_approval"
  | "blocked"
  | "failed"
  | "needs_attention";

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
  let cleaned = message.trim();

  for (const command of commands) {
    if (cleaned.toUpperCase().startsWith(command.toUpperCase())) {
      cleaned = cleaned.slice(command.length).trim();
    }
  }

  return cleaned;
}

function extractCodeBlock(text: string) {
  const match = text.match(/```[\w-]*\n([\s\S]*?)```/);

  if (match?.[1]) {
    return match[1].trim();
  }

  return text.trim();
}

function parsePathOnly(message: string, commands: string[]) {
  const cleaned = stripCommand(message, commands);
  return cleaned.split("\n")[0].trim();
}

function parsePathAndBody(message: string, commands: string[]) {
  const cleaned = stripCommand(message, commands);
  const lines = cleaned.split("\n");
  const filePath = lines.shift()?.trim() || "";
  const body = extractCodeBlock(lines.join("\n"));

  return {
    filePath,
    body,
  };
}

function parsePatch(message: string) {
  const { filePath, body } = parsePathAndBody(message, [
    "PATCH_FILE:",
    "PATCH_REAL_FILE:",
  ]);

  const searchMatch = body.match(/SEARCH:\s*([\s\S]*?)\s*REPLACE:/i);
  const replaceMatch = body.match(/REPLACE:\s*([\s\S]*)/i);

  return {
    filePath,
    patch: body,
    searchText: searchMatch?.[1]?.trim() || "",
    replacementText: replaceMatch?.[1]?.trim() || "",
  };
}

async function rememberCodeFile(
  filePath: string,
  content: string,
  source = "code-tools-handler"
) {
  try {
    await setActiveCodeFile(filePath);

    const summary = await (createSmartCodeSummary as any)(
      filePath,
      content
    );

    const memoryPayload = {
      file_path: filePath,
      file_purpose: (detectFilePurpose as any)(filePath, content),
      code_summary: summary,
      important_exports: (extractExports as any)(content),
      important_functions: (extractFunctions as any)(content),
      risk_level: (detectRiskLevel as any)(filePath, content),
      last_known_content: content.slice(0, 12000),
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

export async function handleListFiles(message = "LIST_FILES: app") {
  try {
    const startDirectory =
      parsePathOnly(message, ["LIST_FILES:", "LIST_PROJECT_FILES:"]) ||
      "app";

    const files = await listProjectFiles(startDirectory);
    const detailed = await listProjectFilesDetailed(startDirectory);

    return response("LIST_FILES", "completed", {
      status: "completed",
      startDirectory,
      count: files.length,
      files,
      detailed,
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
      "READ_REAL_FILE:",
      "READ_FILE:",
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
      "ANALYZE_REAL_FILE:",
      "ANALYZE_FILE:",
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
      "WRITE_FILE:",
      "WRITE_REAL_FILE:",
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
    });

    const pendingAction = await savePendingAction({
      action_type: "WRITE_FILE",
      file_path: filePath,
      content: body,
      reason: "Awenia generated file write",
      source: "code-tools-handler",
      metadata: {
        risk,
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
    });

    const pendingAction = await savePendingAction({
      action_type: "PATCH_FILE",
      file_path: parsed.filePath,
      patch: parsed.patch,
      reason: "Awenia generated file patch",
      source: "code-tools-handler",
      metadata: {
        risk,
        searchText: parsed.searchText,
        replacementText: parsed.replacementText,
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
  try {
    const { filePath, body } = parsePathAndBody(message, [
      "EXECUTE_WRITE_FILE:",
    ]);

    const validation = validateProjectFilePath(filePath, "write");

    if (!validation.allowed) {
      return response("EXECUTE_WRITE_FILE", "blocked", {
        status: "blocked",
        validation,
      });
    }

    const result = await writeProjectFile(filePath, body);
    const memory = await rememberCodeFile(
      filePath,
      body,
      "EXECUTE_WRITE_FILE"
    );

    return response("EXECUTE_WRITE_FILE", "completed", {
      status: "completed",
      result,
      memory,
    });
  } catch (error: any) {
    return response("EXECUTE_WRITE_FILE", "failed", {
      status: "failed",
      error: error?.message || "Unknown EXECUTE_WRITE_FILE error",
    });
  }
}

export async function handleExecutePatchFile(message: string) {
  try {
    const parsed = parsePatch(message);

    if (!parsed.filePath || !parsed.searchText || !parsed.replacementText) {
      return response("EXECUTE_PATCH_FILE", "needs_attention", {
        status: "needs_attention",
        reason:
          "Patch execution needs file path plus SEARCH: and REPLACE: blocks.",
      });
    }

    const validation = validateProjectFilePath(parsed.filePath, "patch");

    if (!validation.allowed) {
      return response("EXECUTE_PATCH_FILE", "blocked", {
        status: "blocked",
        validation,
      });
    }

    const result = await patchProjectFile(
      parsed.filePath,
      parsed.searchText,
      parsed.replacementText
    );

    const content = await readProjectFile(parsed.filePath);
    const memory = await rememberCodeFile(
      parsed.filePath,
      content,
      "EXECUTE_PATCH_FILE"
    );

    return response("EXECUTE_PATCH_FILE", "completed", {
      status: "completed",
      result,
      memory,
    });
  } catch (error: any) {
    return response("EXECUTE_PATCH_FILE", "failed", {
      status: "failed",
      error: error?.message || "Unknown EXECUTE_PATCH_FILE error",
    });
  }
}

export async function handleRollbackFile(message: string) {
  try {
    const filePath = parsePathOnly(message, [
      "ROLLBACK_FILE:",
      "ROLLBACK_REAL_FILE:",
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
    });

    const pendingAction = await savePendingAction({
      action_type: "ROLLBACK_FILE",
      file_path: filePath,
      reason: "Awenia requested rollback",
      source: "code-tools-handler",
      metadata: {
        risk,
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
  try {
    const filePath = parsePathOnly(message, ["EXECUTE_ROLLBACK_FILE:"]);

    if (!filePath) {
      return response("EXECUTE_ROLLBACK_FILE", "needs_attention", {
        status: "needs_attention",
        reason: "Missing file path",
      });
    }

    const result = await rollbackProjectFile(filePath);
    const content = await readProjectFile(filePath);
    const memory = await rememberCodeFile(
      filePath,
      content,
      "EXECUTE_ROLLBACK_FILE"
    );

    return response("EXECUTE_ROLLBACK_FILE", "completed", {
      status: "completed",
      result,
      memory,
    });
  } catch (error: any) {
    return response("EXECUTE_ROLLBACK_FILE", "failed", {
      status: "failed",
      error: error?.message || "Unknown EXECUTE_ROLLBACK_FILE error",
    });
  }
}

export async function handleGeneratePatch(message: string) {
  try {
    const { filePath, body } = parsePathAndBody(message, [
      "GENERATE_PATCH:",
      "CREATE_PATCH:",
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
      "SEARCH_FILES:",
      "FIND_FILES:",
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
      "SEARCH_INSIDE_FILES:",
      "SEARCH_CODE:",
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