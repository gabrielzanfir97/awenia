import {
  readProjectFile,
  analyzeProjectFileSafety,
  validateProjectFilePath,
} from "./dev-agent";

import {
  analyzePendingActionRisk,
  createPendingPatchAction,
} from "./pending-actions";

export type PatchRisk = "low" | "medium" | "high" | "critical";

export type PatchStatus =
  | "ready"
  | "needs_attention"
  | "pending_approval"
  | "blocked"
  | "failed";

export type SearchReplacePatch = {
  filePath: string;
  searchText: string;
  replacementText: string;
  reason: string;
  risk: PatchRisk;
  requiresApproval: boolean;
  blocked: boolean;
  confidence: number;
  patchText: string;
  validation: PatchValidation;
  timestamp: string;
};

export type PatchValidation = {
  valid: boolean;
  canApply: boolean;
  reasons: string[];
  matches: number;
  changesLineCount: number;
};

function now() {
  return new Date().toISOString();
}

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n").trim();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(content: string, searchText: string) {
  if (!searchText) return 0;

  const regex = new RegExp(escapeRegExp(searchText), "g");
  return (content.match(regex) || []).length;
}

function detectPatchRisk(filePath: string, searchText: string, replacementText: string): PatchRisk {
  const normalized = filePath.toLowerCase();

  if (
    normalized.includes(".env") ||
    normalized.includes(".git") ||
    normalized.includes("node_modules") ||
    normalized.includes("protected-core")
  ) {
    return "critical";
  }

  if (
    normalized.includes("app/api/") ||
    normalized.includes("route.ts") ||
    normalized.includes("memory-store.ts") ||
    normalized.includes("supabase.ts") ||
    normalized.includes("dev-agent.ts") ||
    normalized.includes("pending-actions.ts")
  ) {
    return "high";
  }

  const replacementLower = replacementText.toLowerCase();

  if (
    replacementLower.includes("process.env") ||
    replacementLower.includes("delete") ||
    replacementLower.includes("rm -rf") ||
    replacementLower.includes("exec(")
  ) {
    return "high";
  }

  if (searchText.length > 1000 || replacementText.length > 2000) {
    return "medium";
  }

  return "medium";
}

function buildPatchText(searchText: string, replacementText: string) {
  return [
    "SEARCH:",
    searchText,
    "",
    "REPLACE:",
    replacementText,
  ].join("\n");
}

export function validateSearchReplacePatch(input: {
  currentContent?: string;
  searchText: string;
  replacementText: string;
}): PatchValidation {
  const reasons: string[] = [];

  const searchText = normalizeText(input.searchText || "");
  const replacementText = normalizeText(input.replacementText || "");
  const currentContent = input.currentContent;

  if (!searchText) {
    reasons.push("Missing searchText");
  }

  if (!replacementText) {
    reasons.push("Missing replacementText");
  }

  if (searchText === replacementText) {
    reasons.push("Search text and replacement text are identical");
  }

  let matches = 0;

  if (currentContent !== undefined && searchText) {
    matches = countMatches(currentContent, searchText);

    if (matches === 0) {
      reasons.push("Search text was not found in current file content");
    }

    if (matches > 1) {
      reasons.push("Search text appears multiple times; patch is ambiguous");
    }
  }

  const changesLineCount =
    replacementText.split("\n").length - searchText.split("\n").length;

  return {
    valid: reasons.length === 0,
    canApply:
      reasons.length === 0 &&
      (currentContent === undefined || matches === 1),
    reasons,
    matches,
    changesLineCount,
  };
}

export function createSearchReplacePatch(input: {
  filePath: string;
  searchText: string;
  replacementText: string;
  reason?: string;
  currentContent?: string;
}): SearchReplacePatch {
  const filePath = input.filePath.trim();
  const searchText = normalizeText(input.searchText);
  const replacementText = normalizeText(input.replacementText);

  const validation = validateSearchReplacePatch({
    currentContent: input.currentContent,
    searchText,
    replacementText,
  });

  const risk = detectPatchRisk(filePath, searchText, replacementText);

  const requiresApproval =
    risk === "medium" || risk === "high" || risk === "critical";

  const blocked = risk === "critical";

  const confidence = validation.canApply
    ? risk === "high"
      ? 70
      : 85
    : 30;

  return {
    filePath,
    searchText,
    replacementText,
    reason: input.reason || "Awenia generated patch",
    risk,
    requiresApproval,
    blocked,
    confidence,
    patchText: buildPatchText(searchText, replacementText),
    validation,
    timestamp: now(),
  };
}

export function applyPatchToContent(
  currentContent: string,
  patch: SearchReplacePatch
) {
  const validation = validateSearchReplacePatch({
    currentContent,
    searchText: patch.searchText,
    replacementText: patch.replacementText,
  });

  if (!validation.canApply) {
    return {
      success: false,
      content: currentContent,
      validation,
      reason: validation.reasons.join("; "),
    };
  }

  return {
    success: true,
    content: currentContent.replace(
      patch.searchText,
      patch.replacementText
    ),
    validation,
    reason: "Patch applied to preview content",
  };
}

export async function generatePatchForFile(input: {
  filePath: string;
  searchText: string;
  replacementText: string;
  reason?: string;
  saveAsPending?: boolean;
}) {
  const startedAt = now();

  try {
    const pathValidation = validateProjectFilePath(input.filePath, "patch");

    if (!pathValidation.allowed) {
      return {
        status: "blocked" as PatchStatus,
        filePath: input.filePath,
        reason: pathValidation.reason,
        pathValidation,
        timestamp: now(),
      };
    }

    const currentContent = await readProjectFile(input.filePath);
    const safety = await analyzeProjectFileSafety(input.filePath);

    const patch = createSearchReplacePatch({
      filePath: input.filePath,
      searchText: input.searchText,
      replacementText: input.replacementText,
      reason: input.reason,
      currentContent,
    });

    const risk = analyzePendingActionRisk({
      action_type: "PATCH_FILE",
      file_path: input.filePath,
      patch: patch.patchText,
      reason: patch.reason,
      source: "patch-generator",
    });

    let pendingAction = null;

    if (input.saveAsPending && !risk.blocked) {
      pendingAction = await createPendingPatchAction(
        input.filePath,
        patch.patchText,
        patch.reason
      );
    }

    return {
      status: risk.blocked
        ? "blocked"
        : patch.requiresApproval
          ? "pending_approval"
          : "ready",

      filePath: input.filePath,

      patch,

      safety,

      risk,

      pendingAction,

      preview: applyPatchToContent(currentContent, patch),

      execution: {
        startedAt,
        completedAt: now(),
      },

      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as PatchStatus,
      filePath: input.filePath,
      error: error?.message || "Unknown patch generation error",
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  }
}

export function parseSearchReplacePatch(patchText: string) {
  const searchMatch = patchText.match(/SEARCH:\s*([\s\S]*?)\s*REPLACE:/i);
  const replaceMatch = patchText.match(/REPLACE:\s*([\s\S]*)/i);

  return {
    searchText: normalizeText(searchMatch?.[1] || ""),
    replacementText: normalizeText(replaceMatch?.[1] || ""),
  };
}

export function validatePatchText(
  patchText: string,
  currentContent?: string
) {
  const parsed = parseSearchReplacePatch(patchText);

  return validateSearchReplacePatch({
    currentContent,
    searchText: parsed.searchText,
    replacementText: parsed.replacementText,
  });
}

export function createPatchPlan(input: {
  filePath: string;
  request: string;
  currentPreview?: string;
}) {
  return {
    status: "needs_attention",
    filePath: input.filePath,
    request: input.request,
    currentPreview: input.currentPreview || "",
    requiredFormat: {
      search: "SEARCH:",
      replace: "REPLACE:",
    },
    instruction:
      "Use verified current file content. Choose one exact SEARCH block and one REPLACE block. Do not guess file content.",
    timestamp: now(),
  };
}

export async function generatePatch(input: {
  filePath: string;
  searchText: string;
  replacementText: string;
  reason?: string;
}) {
  return generatePatchForFile(input);
}

export const createPatch = createSearchReplacePatch;
export const previewPatch = applyPatchToContent;
export const validatePatch = validateSearchReplacePatch;
export const parsePatch = parseSearchReplacePatch;