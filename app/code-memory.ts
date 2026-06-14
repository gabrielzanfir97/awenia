import { supabase, isSupabaseConfigured } from "./supabase";
import { saveCodeEmbedding } from "./embeddings";

export type CodeRiskLevel = "low" | "medium" | "high" | "critical";

export type CodeMemoryStatus =
  | "saved"
  | "loaded"
  | "searched"
  | "partial"
  | "fallback"
  | "failed";

export type CodeMemoryData = {
  file_path: string;
  file_purpose: string;
  code_summary: string;
  important_exports: string[];
  important_functions: string[];
  imports: string[];
  exports: string[];
  risk_level: CodeRiskLevel;
  line_count: number;
  content_length: number;
  last_known_content: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
};

const runtimeCodeMemory = new Map<string, CodeMemoryData>();

let activeCodeFile: {
  filePath: string;
  content?: string;
  summary?: string;
  updatedAt: string;
} | null = null;

function now() {
  return new Date().toISOString();
}

function normalizePath(filePath = "") {
  return filePath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
}

function normalizeCode(content = "") {
  return content.replace(/\r\n/g, "\n");
}

function normalizeArray(value: any): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function calculateLineCount(content = "") {
  if (!content) return 0;

  return normalizeCode(content).split("\n").length;
}

export function extractImports(content = "") {
  const code = normalizeCode(content);
  const imports: string[] = [];

  const importRegex =
    /import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["'];?/g;

  for (const match of code.matchAll(importRegex)) {
    if (match[1]) imports.push(match[1]);
  }

  const sideEffectImportRegex = /import\s+["']([^"']+)["'];?/g;

  for (const match of code.matchAll(sideEffectImportRegex)) {
    if (match[1]) imports.push(match[1]);
  }

  return unique(imports);
}

export function extractExports(content = "") {
  const code = normalizeCode(content);
  const exports: string[] = [];

  const namedExportRegex =
    /export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g;

  for (const match of code.matchAll(namedExportRegex)) {
    if (match[1]) exports.push(match[1]);
  }

  const defaultExportRegex =
    /export\s+default\s+([A-Za-z0-9_]+)/g;

  for (const match of code.matchAll(defaultExportRegex)) {
    if (match[1]) exports.push(`default:${match[1]}`);
  }

  const groupedExportRegex = /export\s*{\s*([^}]+)\s*}/g;

  for (const match of code.matchAll(groupedExportRegex)) {
    const names = (match[1] || "")
      .split(",")
      .map((item) => item.trim().split(/\s+as\s+/i)[0])
      .filter(Boolean);

    exports.push(...names);
  }

  return unique(exports);
}

export function extractFunctions(content = "") {
  const code = normalizeCode(content);
  const functions: string[] = [];

  const functionRegex =
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g;

  for (const match of code.matchAll(functionRegex)) {
    if (match[1]) functions.push(match[1]);
  }

  const arrowFunctionRegex =
    /(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;

  for (const match of code.matchAll(arrowFunctionRegex)) {
    if (match[1]) functions.push(match[1]);
  }

  const simpleArrowRegex =
    /(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?[A-Za-z0-9_]+\s*=>/g;

  for (const match of code.matchAll(simpleArrowRegex)) {
    if (match[1]) functions.push(match[1]);
  }

  return unique(functions);
}

export function detectRiskLevel(
  filePath: string,
  content = ""
): CodeRiskLevel {
  const file = normalizePath(filePath).toLowerCase();
  const lowerContent = content.toLowerCase();

  if (
    file.includes(".env") ||
    file.includes(".git") ||
    file.includes("node_modules") ||
    file.includes("protected-core.ts") ||
    lowerContent.includes("service_role") ||
    lowerContent.includes("private_key")
  ) {
    return "critical";
  }

  if (
    file.includes("app/api/awenia/route.ts") ||
    file.includes("memory-store.ts") ||
    file.includes("supabase.ts") ||
    file.includes("security.ts") ||
    file.includes("pending-actions.ts") ||
    file.includes("dev-agent.ts")
  ) {
    return "high";
  }

  if (
    file.includes("api/") ||
    file.includes("runtime") ||
    file.includes("agent") ||
    file.includes("evolution") ||
    lowerContent.includes("fetch(") ||
    lowerContent.includes("supabase.")
  ) {
    return "medium";
  }

  return "low";
}

export function detectFilePurpose(filePath: string, content = "") {
  const file = normalizePath(filePath).toLowerCase();
  const code = content.toLowerCase();

  if (file.includes("app/api/awenia/route.ts")) {
    return "Main Awenia API route / backend brain";
  }

  if (file.endsWith("page.tsx")) {
    return "Main chat UI page";
  }

  if (file.includes("layout.tsx")) {
    return "Next.js layout";
  }

  if (file.includes("memory-store.ts")) {
    return "Supabase long-term memory store";
  }

  if (file.includes("memory.ts")) {
    return "Awenia memory context and local memory seed";
  }

  if (file.includes("code-memory.ts")) {
    return "Project code memory and code awareness system";
  }

  if (file.includes("code-tools-handler.ts")) {
    return "Handlers for reading, writing, patching and analyzing code files";
  }

  if (file.includes("dev-agent.ts")) {
    return "Local filesystem development agent";
  }

  if (file.includes("pending-actions.ts")) {
    return "Approval queue for risky code actions";
  }

  if (file.includes("supabase.ts")) {
    return "Supabase client and connection health system";
  }

  if (file.includes("internet.ts")) {
    return "Verified internet search and fetch system";
  }

  if (file.includes("internet-learning.ts")) {
    return "Internet learning runtime";
  }

  if (file.includes("awareness.ts")) {
    return "Real awareness state from memory, goals, skills and evolution";
  }

  if (file.includes("consciousness.ts")) {
    return "Combined Awenia consciousness state";
  }

  if (file.includes("decision-engine.ts")) {
    return "Autonomous decision engine";
  }

  if (file.includes("goal-manager.ts")) {
    return "Autonomous goal manager";
  }

  if (file.includes("self-improvement.ts")) {
    return "Self-improvement cycle";
  }

  if (file.includes("autonomous-runtime.ts")) {
    return "Autonomous runtime coordinator";
  }

  if (file.includes("evolution-runtime.ts")) {
    return "Evolution runtime coordinator";
  }

  if (file.includes("agents.ts")) {
    return "Agent definitions and runtime agent memory";
  }

  if (file.includes("agent-orchestrator.ts")) {
    return "Multi-agent workflow orchestrator";
  }

  if (file.includes("orchestrator.ts")) {
    return "Main message orchestrator";
  }

  if (file.includes("routing.ts")) {
    return "Message routing system";
  }

  if (file.includes("skills.ts")) {
    return "Skill detection and skill state system";
  }

  if (file.includes("system-prompt.ts") || file.includes("prompts.ts")) {
    return "System prompt and message prompt builder";
  }

  if (file.includes("personality.ts")) {
    return "Awenia personality state and behavior rules";
  }

  if (file.includes("security.ts") || file.includes("protected-core.ts")) {
    return "Security, truth and approval protection layer";
  }

  if (file.includes("project-map.ts")) {
    return "Project map and module awareness";
  }

  if (file.includes("project-state.ts")) {
    return "Verified project state summary";
  }

  if (code.includes("export async function")) {
    return "Async TypeScript module with exported runtime functions";
  }

  if (code.includes("export function")) {
    return "TypeScript utility module with exported functions";
  }

  if (file.endsWith(".tsx")) {
    return "React/Next.js UI component";
  }

  return "General TypeScript project file";
}

export function createCodeSummary(
  filePathOrContent: string,
  maybeContent?: string
) {
  const filePath = maybeContent ? filePathOrContent : "unknown";
  const content = maybeContent ? maybeContent : filePathOrContent;

  const imports = extractImports(content);
  const exports = extractExports(content);
  const functions = extractFunctions(content);
  const purpose = detectFilePurpose(filePath, content);
  const risk = detectRiskLevel(filePath, content);

  return [
    `Purpose: ${purpose}`,
    `Risk: ${risk}`,
    `Lines: ${calculateLineCount(content)}`,
    `Imports: ${imports.length ? imports.join(", ") : "none"}`,
    `Exports: ${exports.length ? exports.join(", ") : "none"}`,
    `Functions: ${functions.length ? functions.join(", ") : "none"}`,
  ].join("\n");
}

export function createSmartCodeSummary(
  filePath: string,
  content = ""
) {
  const imports = extractImports(content);
  const exports = extractExports(content);
  const functions = extractFunctions(content);
  const purpose = detectFilePurpose(filePath, content);
  const risk = detectRiskLevel(filePath, content);

  const mainLogic = normalizeCode(content)
    .split("\n")
    .filter((line) => {
      const clean = line.trim();

      if (!clean) return false;
      if (clean.startsWith("import ")) return false;
      if (clean.startsWith("//")) return false;

      return (
        clean.startsWith("export ") ||
        clean.startsWith("async function") ||
        clean.startsWith("function") ||
        clean.includes("return ") ||
        clean.includes("await ") ||
        clean.includes("supabase") ||
        clean.includes("fetch(")
      );
    })
    .slice(0, 25)
    .join("\n");

  return [
    `File: ${normalizePath(filePath)}`,
    `Purpose: ${purpose}`,
    `Risk level: ${risk}`,
    `Line count: ${calculateLineCount(content)}`,
    `Content length: ${content.length}`,
    "",
    `Imports (${imports.length}): ${imports.length ? imports.join(", ") : "none"}`,
    `Exports (${exports.length}): ${exports.length ? exports.join(", ") : "none"}`,
    `Functions (${functions.length}): ${functions.length ? functions.join(", ") : "none"}`,
    "",
    "Main logic preview:",
    mainLogic || "No main logic detected.",
  ].join("\n");
}

function buildCodeMemoryRecord(
  filePath: string,
  content = "",
  metadata: any = {}
): CodeMemoryData {
  const normalizedPath = normalizePath(filePath);
  const cleanContent = normalizeCode(content);

  return {
    file_path: normalizedPath,
    file_purpose: detectFilePurpose(normalizedPath, cleanContent),
    code_summary: createSmartCodeSummary(normalizedPath, cleanContent),
    important_exports: extractExports(cleanContent),
    important_functions: extractFunctions(cleanContent),
    imports: extractImports(cleanContent),
    exports: extractExports(cleanContent),
    risk_level: detectRiskLevel(normalizedPath, cleanContent),
    line_count: calculateLineCount(cleanContent),
    content_length: cleanContent.length,
    last_known_content: cleanContent.slice(0, 12000),
    metadata,
    created_at: now(),
    updated_at: now(),
  };
}

async function saveCodeMemoryToSupabase(record: CodeMemoryData) {
  if (!isSupabaseConfigured()) {
    return {
      status: "fallback",
      saved: false,
      error: "Supabase is not configured",
    };
  }

  try {
    const payload = {
      file_path: record.file_path,
      file_purpose: record.file_purpose,
      code_summary: record.code_summary,
      important_exports: record.important_exports,
      important_functions: record.important_functions,
      imports: record.imports,
      exports: record.exports,
      risk_level: record.risk_level,
      line_count: record.line_count,
      content_length: record.content_length,
      last_known_content: record.last_known_content,
      metadata: record.metadata || {},
      updated_at: record.updated_at,
    };

    const { data, error } = await supabase
      .from("project_code_memory")
      .upsert(payload as any, {
        onConflict: "file_path",
      })
      .select()
      .single();

    if (error) {
      return {
        status: "failed",
        saved: false,
        error: error.message,
      };
    }

    return {
      status: "saved",
      saved: true,
      data,
    };
  } catch (error: any) {
    return {
      status: "failed",
      saved: false,
      error: error?.message || "Failed to save code memory",
    };
  }
}

export async function saveCodeMemory(
  input: string | Partial<CodeMemoryData>,
  content = "",
  options?: {
    saveToSupabase?: boolean;
    saveEmbedding?: boolean;
    metadata?: any;
  }
) {
  const record =
    typeof input === "string"
      ? buildCodeMemoryRecord(
        input,
        content,
        options?.metadata || {}
      )
      : ({
        ...buildCodeMemoryRecord(
          input.file_path || "unknown",
          input.last_known_content || content || "",
          options?.metadata || input.metadata || {}
        ),
        ...input,
        file_path: normalizePath(input.file_path || "unknown"),
        important_exports: normalizeArray(input.important_exports),
        important_functions: normalizeArray(input.important_functions),
        imports: normalizeArray(input.imports),
        exports: normalizeArray(input.exports),
        updated_at: now(),
      } as CodeMemoryData);

  runtimeCodeMemory.set(record.file_path, record);

  let supabaseResult: any = null;
  let embeddingResult: any = null;

  if (options?.saveToSupabase ?? true) {
    supabaseResult = await saveCodeMemoryToSupabase(record);
  }

  if (options?.saveEmbedding ?? true) {
    try {
      embeddingResult = await saveCodeEmbedding(
        record.file_path,
        record.last_known_content,
        {
          purpose: record.file_purpose,
          risk: record.risk_level,
          exports: record.important_exports,
          functions: record.important_functions,
        }
      );
    } catch (error: any) {
      embeddingResult = {
        status: "failed",
        error: error?.message || "Failed to save code embedding",
      };
    }
  }

  return {
    status:
      supabaseResult?.status === "failed" ||
        embeddingResult?.status === "failed"
        ? ("partial" as CodeMemoryStatus)
        : ("saved" as CodeMemoryStatus),
    record,
    runtimeSaved: true,
    supabase: supabaseResult,
    embedding: embeddingResult,
    timestamp: now(),
  };
}

function normalizeSupabaseCodeMemory(item: any): CodeMemoryData {
  return {
    file_path: normalizePath(item.file_path || "unknown"),
    file_purpose: item.file_purpose || "Unknown purpose",
    code_summary: item.code_summary || "",
    important_exports: normalizeArray(item.important_exports),
    important_functions: normalizeArray(item.important_functions),
    imports: normalizeArray(item.imports),
    exports: normalizeArray(item.exports),
    risk_level: item.risk_level || "medium",
    line_count: Number(item.line_count || 0),
    content_length: Number(item.content_length || 0),
    last_known_content: item.last_known_content || "",
    metadata: item.metadata || {},
    created_at: item.created_at || now(),
    updated_at: item.updated_at || now(),
  };
}

export async function getCodeMemory(filePath: string) {
  const normalizedPath = normalizePath(filePath);

  const runtime = runtimeCodeMemory.get(normalizedPath);

  if (runtime) {
    return {
      status: "loaded" as CodeMemoryStatus,
      source: "runtime",
      record: runtime,
      timestamp: now(),
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "fallback" as CodeMemoryStatus,
      source: "runtime",
      record: null,
      error: "Supabase is not configured and runtime memory has no record",
      timestamp: now(),
    };
  }

  try {
    const { data, error } = await supabase
      .from("project_code_memory")
      .select("*")
      .eq("file_path", normalizedPath)
      .maybeSingle();

    if (error) {
      return {
        status: "failed" as CodeMemoryStatus,
        source: "supabase",
        record: null,
        error: error.message,
        timestamp: now(),
      };
    }

    if (!data) {
      return {
        status: "fallback" as CodeMemoryStatus,
        source: "supabase",
        record: null,
        error: "No code memory found",
        timestamp: now(),
      };
    }

    const record = normalizeSupabaseCodeMemory(data);

    runtimeCodeMemory.set(record.file_path, record);

    return {
      status: "loaded" as CodeMemoryStatus,
      source: "supabase",
      record,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as CodeMemoryStatus,
      source: "supabase",
      record: null,
      error: error?.message || "Failed to load code memory",
      timestamp: now(),
    };
  }
}

export async function getAllCodeMemories(limit = 200) {
  const runtime = Array.from(runtimeCodeMemory.values()).slice(0, limit);

  if (!isSupabaseConfigured()) {
    return {
      status: "fallback" as CodeMemoryStatus,
      runtime,
      supabase: [],
      records: runtime,
      count: runtime.length,
      timestamp: now(),
    };
  }

  try {
    const { data, error } = await supabase
      .from("project_code_memory")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        status: runtime.length > 0 ? "partial" : "failed",
        runtime,
        supabase: [],
        records: runtime,
        error: error.message,
        count: runtime.length,
        timestamp: now(),
      };
    }

    const supabaseRecords = (data || []).map(normalizeSupabaseCodeMemory);

    for (const record of supabaseRecords) {
      runtimeCodeMemory.set(record.file_path, record);
    }

    const merged = Array.from(runtimeCodeMemory.values()).slice(0, limit);

    return {
      status: "loaded" as CodeMemoryStatus,
      runtime,
      supabase: supabaseRecords,
      records: merged,
      count: merged.length,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: runtime.length > 0 ? "partial" : "failed",
      runtime,
      supabase: [],
      records: runtime,
      error: error?.message || "Failed to load all code memories",
      count: runtime.length,
      timestamp: now(),
    };
  }
}

function scoreCodeMemory(record: CodeMemoryData, query: string) {
  const lowerQuery = query.toLowerCase();

  const haystack = [
    record.file_path,
    record.file_purpose,
    record.code_summary,
    record.important_exports.join(" "),
    record.important_functions.join(" "),
    record.imports.join(" "),
    record.exports.join(" "),
    record.last_known_content.slice(0, 3000),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;

  if (record.file_path.toLowerCase().includes(lowerQuery)) score += 50;
  if (record.file_purpose.toLowerCase().includes(lowerQuery)) score += 30;
  if (record.code_summary.toLowerCase().includes(lowerQuery)) score += 25;
  if (record.important_exports.join(" ").toLowerCase().includes(lowerQuery)) {
    score += 25;
  }
  if (record.important_functions.join(" ").toLowerCase().includes(lowerQuery)) {
    score += 25;
  }
  if (haystack.includes(lowerQuery)) score += 10;

  const words = lowerQuery.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (haystack.includes(word)) score += 3;
  }

  return score;
}

export async function searchCodeMemory(
  query: string,
  limit = 10
) {
  const safeQuery = query.trim();

  if (!safeQuery) {
    return {
      status: "searched" as CodeMemoryStatus,
      query,
      results: [],
      count: 0,
      timestamp: now(),
    };
  }

  const all = await getAllCodeMemories(300);
  const records: CodeMemoryData[] = all.records || [];

  const results = records
    .map((record) => ({
      record,
      score: scoreCodeMemory(record, safeQuery),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    status: "searched" as CodeMemoryStatus,
    query: safeQuery,
    results,
    count: results.length,
    sourceStatus: all.status,
    timestamp: now(),
  };
}

export function setActiveCodeFile(
  filePath: string,
  content?: string
) {
  const normalizedPath = normalizePath(filePath);

  activeCodeFile = {
    filePath: normalizedPath,
    content,
    summary: content
      ? createSmartCodeSummary(normalizedPath, content)
      : undefined,
    updatedAt: now(),
  };

  return activeCodeFile;
}

export function getActiveCodeFile() {
  return activeCodeFile;
}

export async function rememberCodeFile(
  filePath: string,
  content: string,
  metadata: any = {}
) {
  setActiveCodeFile(filePath, content);

  return saveCodeMemory(filePath, content, {
    saveToSupabase: true,
    saveEmbedding: true,
    metadata,
  });
}

export async function analyzeCodeFile(
  filePath: string,
  content: string
) {
  const record = buildCodeMemoryRecord(filePath, content);

  return {
    status: "loaded" as CodeMemoryStatus,
    record,
    summary: record.code_summary,
    purpose: record.file_purpose,
    risk: record.risk_level,
    imports: record.imports,
    exports: record.exports,
    functions: record.important_functions,
    timestamp: now(),
  };
}

export function buildCodeMemoryContext(records: CodeMemoryData[]) {
  if (records.length === 0) {
    return "Nu există code memory verificată pentru această căutare.";
  }

  return records
    .map((record, index) => {
      return [
        `${index + 1}. ${record.file_path}`,
        `Purpose: ${record.file_purpose}`,
        `Risk: ${record.risk_level}`,
        `Exports: ${record.important_exports.join(", ") || "none"}`,
        `Functions: ${record.important_functions.join(", ") || "none"}`,
        `Summary: ${record.code_summary.slice(0, 1200)}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function getCodeMemoryContext(
  query: string,
  limit = 5
) {
  const search = await searchCodeMemory(query, limit);

  return buildCodeMemoryContext(
    search.results.map((item: any) => item.record)
  );
}

export function getRuntimeCodeMemories() {
  return Array.from(runtimeCodeMemory.values());
}

export function clearRuntimeCodeMemory() {
  const count = runtimeCodeMemory.size;

  runtimeCodeMemory.clear();

  return {
    status: "cleared",
    count,
    timestamp: now(),
  };
}

export function getCodeMemoryState() {
  return {
    status: "loaded" as CodeMemoryStatus,
    runtimeCount: runtimeCodeMemory.size,
    activeCodeFile,
    supabaseConfigured: isSupabaseConfigured(),
    truthPolicy: {
      noFakeCodeAwareness: true,
      noClaimFileKnownWithoutRead: true,
      runtimeMemoryIsNotDatabaseMemory: true,
    },
    timestamp: now(),
  };
}

export async function runCodeMemorySystem(query = "") {
  if (!query.trim()) {
    return getCodeMemoryState();
  }

  const search = await searchCodeMemory(query, 10);

  return {
    status: "searched" as CodeMemoryStatus,
    query,
    search,
    context: buildCodeMemoryContext(
      search.results.map((item: any) => item.record)
    ),
    state: getCodeMemoryState(),
    timestamp: now(),
  };
}

export const getCodeMemoryByFile = getCodeMemory;
export const listCodeMemories = getAllCodeMemories;
export const rememberCode = rememberCodeFile;
export const saveProjectCodeMemory = saveCodeMemory;
export const searchProjectCodeMemory = searchCodeMemory;
export const createSmartSummary = createSmartCodeSummary;
export const createSummary = createCodeSummary;
export const detectPurpose = detectFilePurpose;
export const detectCodeRisk = detectRiskLevel;
export const codeMemory = runtimeCodeMemory;

export default saveCodeMemory;